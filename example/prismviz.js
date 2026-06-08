// Legacy PrismViz bridge.
//
// This file preserves the original non-module d3.prismViz entrypoint and is
// intentionally allowed to read legacy academic-demo field names. New core
// code, reusable components, and sqData demos must not import from this file or
// copy its compatibility aliases; use src/adapters/reference.js for module
// based legacy data conversion.

// D3-HSV Color Space Functions
// Extracted and formatted from d3-hsv.min.js

(function() {
    'use strict';

    // HSV Color Constructor
    function Hsv(h, s, v, opacity) {
        this.h = +h;
        this.s = +s;
        this.v = +v;
        this.opacity = +opacity;
    }

    // Create HSV color from various inputs
    function hsv(h, s, v, opacity) {
        if (arguments.length === 1) {
            // Convert from other color formats
            return rgbToHsv(h);
        }
        return new Hsv(h, s, v, opacity == null ? 1 : opacity);
    }

    // Convert RGB to HSV
    function rgbToHsv(color) {
        if (color instanceof Hsv) {
            return new Hsv(color.h, color.s, color.v, color.opacity);
        }
        
        if (!(color instanceof d3.rgb)) {
            color = d3.rgb(color);
        }

        var r = color.r / 255,
            g = color.g / 255,
            b = color.b / 255,
            min = Math.min(r, g, b),
            max = Math.max(r, g, b),
            delta = max - min,
            h = NaN,
            s = delta / max,
            v = max;

        if (delta) {
            if (r === max) {
                h = (g - b) / delta + (g < b ? 6 : 0);
            } else if (g === max) {
                h = (b - r) / delta + 2;
            } else {
                h = (r - g) / delta + 4;
            }
            h *= 60;
        }

        return new Hsv(h, s, v, color.opacity);
    }

    // Helper function for RGB conversion
    function hsvToRgbHelper(c, x, m, opacity) {
        return d3.rgb(
            255 * (c + m),
            255 * (x + m),
            255 * (m),
            opacity
        );
    }

    // Constant function
    function constant(value) {
        return function() {
            return value;
        };
    }

    // Linear interpolation
    function linear(a, b) {
        var delta = b - a;
        return delta ? function(t) { return a + t * delta; } : constant(isNaN(a) ? b : a);
    }

    // Hue interpolation with wrapping
    function hue(a, b) {
        var delta = b - a;
        return delta ? function(t) {
            return a + t * (delta > 180 || delta < -180 ? delta - 360 * Math.round(delta / 360) : delta);
        } : constant(isNaN(a) ? b : a);
    }

    // HSV interpolation factory
    function hsvInterpolate(hueInterpolator) {
        return function(start, end) {
            var h = hueInterpolator((start = hsv(start)).h, (end = hsv(end)).h),
                s = linear(start.s, end.s),
                v = linear(start.v, end.v),
                opacity = linear(start.opacity, end.opacity);
            
            return function(t) {
                start.h = h(t);
                start.s = s(t);
                start.v = v(t);
                start.opacity = opacity(t);
                return start + "";
            };
        };
    }

    // HSV Prototype Methods
    Hsv.prototype = hsv.prototype = Object.create(d3.color.prototype);
    Hsv.prototype.constructor = Hsv;

    // Brighter color
    Hsv.prototype.brighter = function(k) {
        k = k == null ? 1 / 0.7 : Math.pow(1 / 0.7, k);
        return new Hsv(this.h, this.s, this.v * k, this.opacity);
    };

    // Darker color
    Hsv.prototype.darker = function(k) {
        k = k == null ? 0.7 : Math.pow(0.7, k);
        return new Hsv(this.h, this.s, this.v * k, this.opacity);
    };

    // Convert HSV to RGB
    Hsv.prototype.rgb = function() {
        var h = isNaN(this.h) ? 0 : this.h % 360 + 360 * (this.h < 0),
            s = isNaN(this.h) || isNaN(this.s) ? 0 : this.s,
            v = this.v,
            opacity = this.opacity,
            c = v * s,
            x = c * (1 - Math.abs((h / 60) % 2 - 1)),
            m = v - c;

        if (h < 60) return d3.rgb(255 * (c + m), 255 * (x + m), 255 * m, opacity);
        if (h < 120) return d3.rgb(255 * (x + m), 255 * (c + m), 255 * m, opacity);
        if (h < 180) return d3.rgb(255 * m, 255 * (c + m), 255 * (x + m), opacity);
        if (h < 240) return d3.rgb(255 * m, 255 * (x + m), 255 * (c + m), opacity);
        if (h < 300) return d3.rgb(255 * (x + m), 255 * m, 255 * (c + m), opacity);
        return d3.rgb(255 * (c + m), 255 * m, 255 * (x + m), opacity);
    };

    // Check if color is displayable
    Hsv.prototype.displayable = function() {
        return (0 <= this.s && this.s <= 1 || isNaN(this.s)) &&
               0 <= this.v && this.v <= 1 &&
               0 <= this.opacity && this.opacity <= 1;
    };

    // String representation
    Hsv.prototype.toString = function() {
        return this.rgb() + "";
    };

    // Interpolators
    var interpolateHsv = hsvInterpolate(hue);
    var interpolateHsvLong = hsvInterpolate(linear);

    // Export to d3 namespace
    if (typeof d3 !== 'undefined') {
        d3.hsv = hsv;
        d3.interpolateHsv = interpolateHsv;
        d3.interpolateHsvLong = interpolateHsvLong;
    }

    // Export for module systems
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = {
            hsv: hsv,
            interpolateHsv: interpolateHsv,
            interpolateHsvLong: interpolateHsvLong
        };
    }
})();

// D3-Tip Tooltip Functions
// Standard implementation for d3-tip
(function() {
    'use strict';

    d3.tip = function() {
        var direction = d3_tip_direction,
            offset = d3_tip_offset,
            html = d3_tip_html,
            node = initNode(),
            svg = null,
            point = null,
            target = null;

        function tip(vis) {
            svg = getSVGNode(vis);
            if (!svg) return;
            point = svg.createSVGPoint();
            document.body.appendChild(node);
        }

        // Public - show the tooltip on the screen
        tip.show = function() {
            var args = Array.prototype.slice.call(arguments);
            if (args[args.length - 1] instanceof SVGElement) target = args.pop();

            var content = html.apply(this, args),
                poffset = offset.apply(this, args),
                dir = direction.apply(this, args),
                nodel = getNodeEl(),
                i = directions.length,
                coords,
                scrollTop = document.documentElement.scrollTop || document.body.scrollTop,
                scrollLeft = document.documentElement.scrollLeft || document.body.scrollLeft;

            nodel.html(content)
                .style('opacity', 1)
                .style('pointer-events', 'all');

            while (i--) nodel.classed(directions[i], false);
            coords = direction_callbacks.get(dir).apply(this);
            nodel.classed(dir, true)
                .style('top', (coords.top + poffset[0]) + scrollTop + 'px')
                .style('left', (coords.left + poffset[1]) + scrollLeft + 'px');

            return tip;
        };

        // Public - hide the tooltip
        tip.hide = function() {
            var nodel = getNodeEl();
            nodel.style('opacity', 0).style('pointer-events', 'none');
            return tip;
        };

        // Public: Proxy attr calls to the d3 tip container
        tip.attr = function() {
            d3.select(node).attr.apply(d3.select(node), arguments);
            return tip;
        };

        // Public: Proxy style calls to the d3 tip container
        tip.style = function() {
            d3.select(node).style.apply(d3.select(node), arguments);
            return tip;
        };

        // Public: Set or get the direction of the tooltip
        tip.direction = function(v) {
            if (!arguments.length) return direction;
            direction = v == null ? v : functor(v);
            return tip;
        };

        // Public: Sets or gets the offset of the tooltip
        tip.offset = function(v) {
            if (!arguments.length) return offset;
            offset = v == null ? v : functor(v);
            return tip;
        };

        // Public: sets or gets the html value of the tooltip
        tip.html = function(v) {
            if (!arguments.length) return html;
            html = v == null ? v : functor(v);
            return tip;
        };

        // Public: destroys the tooltip and removes it from the DOM
        tip.destroy = function() {
            if (node) {
                getNodeEl().remove();
                node = null;
            }
            return tip;
        };

        function d3_tip_direction() { return 'n'; }
        function d3_tip_offset() { return [0, 0]; }
        function d3_tip_html() { return ' '; }

        var direction_callbacks = d3.map({
            n: direction_n,
            s: direction_s,
            e: direction_e,
            w: direction_w,
            nw: direction_nw,
            ne: direction_ne,
            sw: direction_sw,
            se: direction_se
        });

        var directions = direction_callbacks.keys();

        function direction_n() {
            var bbox = getScreenBBox();
            return {
                top: bbox.n.y - node.offsetHeight,
                left: bbox.n.x - node.offsetWidth / 2
            };
        }

        function direction_s() {
            var bbox = getScreenBBox();
            return {
                top: bbox.s.y,
                left: bbox.s.x - node.offsetWidth / 2
            };
        }

        function direction_e() {
            var bbox = getScreenBBox();
            return {
                top: bbox.e.y - node.offsetHeight / 2,
                left: bbox.e.x
            };
        }

        function direction_w() {
            var bbox = getScreenBBox();
            return {
                top: bbox.w.y - node.offsetHeight / 2,
                left: bbox.w.x - node.offsetWidth
            };
        }

        function direction_nw() {
            var bbox = getScreenBBox();
            return {
                top: bbox.nw.y - node.offsetHeight,
                left: bbox.nw.x - node.offsetWidth
            };
        }

        function direction_ne() {
            var bbox = getScreenBBox();
            return {
                top: bbox.ne.y - node.offsetHeight,
                left: bbox.ne.x
            };
        }

        function direction_sw() {
            var bbox = getScreenBBox();
            return {
                top: bbox.sw.y,
                left: bbox.sw.x - node.offsetWidth
            };
        }

        function direction_se() {
            var bbox = getScreenBBox();
            return {
                top: bbox.se.y,
                left: bbox.se.x
            };
        }

        function initNode() {
            var node = d3.select(document.createElement('div'));
            node.style('position', 'absolute')
                .style('top', 0)
                .style('opacity', 0)
                .style('pointer-events', 'none')
                .style('box-sizing', 'border-box');
            return node.node();
        }

        function getSVGNode(element) {
            var svgNode = element.node();
            if (!svgNode) return null;
            if (svgNode.tagName.toLowerCase() === 'svg') return svgNode;
            return svgNode.ownerSVGElement;
        }

        function getNodeEl() {
            if (node == null) {
                node = initNode();
                document.body.appendChild(node);
            }
            return d3.select(node);
        }

        function getScreenBBox() {
            var targetel = target || d3.event.target;
            while (targetel.getScreenCTM == null && targetel.parentNode != null) {
                targetel = targetel.parentNode;
            }

            var bbox = {},
                matrix = targetel.getScreenCTM(),
                tbbox = targetel.getBBox(),
                width = tbbox.width,
                height = tbbox.height,
                x = tbbox.x,
                y = tbbox.y;

            point.x = x;
            point.y = y;
            bbox.nw = point.matrixTransform(matrix);
            point.x += width;
            bbox.ne = point.matrixTransform(matrix);
            point.y += height;
            bbox.se = point.matrixTransform(matrix);
            point.x -= width;
            bbox.sw = point.matrixTransform(matrix);
            point.y -= height / 2;
            bbox.w = point.matrixTransform(matrix);
            point.x += width;
            bbox.e = point.matrixTransform(matrix);
            point.x -= width / 2;
            point.y -= height / 2;
            bbox.n = point.matrixTransform(matrix);
            point.y += height;
            bbox.s = point.matrixTransform(matrix);

            return bbox;
        }

        function functor(v) {
            return typeof v === 'function' ? v : function() {
                return v;
            };
        }

        return tip;
    };
})();

(function() {
    'use strict';
const PRISMVIZ_DEBUG = false;
function debugLog(...args) {
    if (PRISMVIZ_DEBUG) console.log(...args);
}
// Input variables
let authorData;
let globalConfig;
let globalFields;
let globalFieldMeta = {};
let viz, vizContext;
// config = {"remove_survey": "1", "remove_isolated": "0","node_prob": 0.5,"edge_prob": 0.5, "topic_prob": 0.55, "node_width": 10, "name": "Visualization","icon": "fas fa-eye icon", "type": "CS Subfield","papers": 75813,"authors": 5015,"links": 88669,"topic": 70, "authorID": "A-1001-2008", "authorName": "John Doe"};

// Prismviz variables
let global_nodes, global_edges, global_paper_field, minYear, maxYear;
let global_entities, global_relations, global_slices;
let global_colors = {}; // 仅初始化一次，后续有相同不再更新
let global_coauthors = {};
let paperID2topic = {};
let entityIdToSliceId = {};
let global_keywords = {};
let topic2graph = {};
let sliceGraphs = {};
let selectedSliceId = null;
let STopic = null;
let paperID2year = {};
let entityIdToTime = {};
let TTM = {}, TTMEdges = {};   // topicTransitionMatrix
let graph;
let sliceAngleRanges = [];
let topicRanges = sliceAngleRanges;
let matrixg, node2size, egroup, ranks, id2attr, ret, ids, point2key, textElement;
let context, width, context_l, context_r, prefix;

let prismRadius;  // basePrismRadius * global_nodes.length / 100
let prismHeight;
// 速度档位状态：新的 1x 对应旧版更快的默认转速
let speedLevel = 1;
const speedMultipliers = [0, 1, 2, 3, 4];
const speedValues = [0, 7.5, 10, 12.5, 15];
let rotationSpeed = speedValues[speedLevel];
let basePrismRadius = 400;
let prismScale;   // basePrismScale * 100 / global_nodes.length
let basePrismScale = 0.9;
let rotationAngleY = 0, rotationAngleX = -25, translationX = 0, translationY = 0;
let isRotating = false; // 用于控制旋转的状态

let dot = '';
let edgeBundling = 1, nodeShape = 3;
let isCollapse = true, regular=true, enlarge=0;
let maxOpacity = 0.8;
let defaultOpacity = 0.9;
let focusedSliceIndex = -1;
let currentIndex = -1;

// global variable (STopic == null)
let toolboxHidden = true, showtag=true, showtagcloud=true;
let hideBackground = false,fullsize=false;

// subgraph variable (global / subgraph, the graph to render)
let svgWidth, svgHeight;
let contextEdgeWeight = 5;
let minCircleSize = 6;

let viewMode = "Prism";
let visType = "GeneticPrism";
let adjacent_ids = [];
let extend_ids = [];
let lastMouseX, lastMouseY; // 上一个鼠标X坐标
let y_focus = 0.5;
let highlighted = [];

let arrangement = [], adjacentMatrix, sliceRelationMatrix;
let originalCost, bestCost;
let bbox_padding_x=0, bbox_padding_y=40;
// let bbox_padding_x=10, bbox_padding_y=100;
let yearGrid = 2, alpha = 10;
let virtualOpacity = 0.3;
let topicOpacity = 0.25;


let isDetail = false;
let highlightOpacity = 1;
let backgroundOpacity = highlightOpacity * 2 / 3;
let polygenView = false;
let contextEdgeColor = 'lightblue';
const streamContextEdgeColor = '#ff7878';
const streamContextEdgeOpacity = 0.78;

// 在函数外部缓存选择结果

let chord_arcs = d3.selectAll(".chord-arc");
let chord_ribbons = d3.selectAll(".chord-ribbon");
let index2chord_element = {};
let activeArea=null;
let activeStreamReset = null;
let activeStreamContextEdgeKeys = new Set();
let Tooltip, tip;
let mainPanelElementId = "middle-column";
let mainPanelOptions = {
    includeFlow: false,
    showModeSwitch: false,
    onSelectSlice: null,
};
let prismInteractionState = {
    suppressClick: false,
    startX: 0,
    startY: 0,
    lastMouseX: 0,
    lastMouseY: 0,
};
let prismAnimationFrame = null;
let prismRotateToFrame = null;
let prismRotateToRestoreSpeed = null;
let activeSyncedSliceId = null;
let responsiveRefreshFrame = null;
let responsiveRefreshTimer = null;
let prismFaceElementBySliceId = {};
let activePrismFaceSliceId = null;
let tagScalePercent = 100;
let chordPanelElementId = "chord";
let chordContentSelector = "#prismviz-chord-content";
let standalonePanelCounter = 0;
let globalDisplayInfo = {};
let globalComponentOptions = {};
let globalTreeRows = null;
const PRISMVIZ_DEFAULT_CONTAINER_IDS = {
    mainPanel: "middle-column",
    drawArea: "prismviz-draw-area",
    prismPanel: "prismviz-prism-panel",
    scrollPanel: "prismviz-scroll-panel",
    tagCloud: "prismviz-slice-tags",
    prismContainer: "prismviz-prism-container",
    prism: "prismviz-prism",
    chordPanel: "chord",
    chordContent: "prismviz-chord-content",
    listPanel: "prismviz-entity-list",
};
const PRISMVIZ_LEGACY_CONTAINER_IDS = {
    mainPanel: "middle-column",
    drawArea: "draw-area",
    prismPanel: "GeneticPrism",
    scrollPanel: "GeneticFlow",
    tagCloud: "tagcloud",
    prismContainer: "prism-container",
    prism: "prism",
    chordPanel: "chord",
    chordContent: "chord-content",
    listPanel: "timeline",
};
let prismVizContainerIds = {...PRISMVIZ_DEFAULT_CONTAINER_IDS};
const PRISMVIZ_FILTER_CONTROL_KEYS = [
    "specialEntityFilter",
    "isolatedEntityFilter",
    "entityThreshold",
    "relationThreshold",
    "sliceMembershipThreshold",
    "timeGrid",
    "rotationSpeed",
    "tagSize",
    "nodeShape",
];
const PRISMVIZ_LAYERED_LAYOUT_MODES = new Set([
    "layered-time",
    "layered-explicit",
    "layered-inferred",
    "layered-scroll",
]);
const PRISMVIZ_DEFAULT_LABELS = {
    entity: "paper",
    relation: "citation",
    slice: "topic",
    specialEntityFilter: "survey papers",
    isolatedEntityFilter: "isolated papers",
    entityThreshold: "#papers (nodes)",
    relationThreshold: "#citations (edges)",
    sliceMembershipThreshold: "topic similarity",
    timeGrid: "year grid",
    rotationSpeed: "rotation speed",
    tagSize: "tag size",
    nodeShape: "node shape",
    sliceTree: "Topic Tree",
    chordDiagram: "Chord Diagram",
    entityList: "Paper List",
    entityInfo: "Paper Info",
    relationInfo: "Citation Relationship",
    back: "Back",
    entityId: "paperID",
    entityName: "title",
    entityMeta: "authors",
    importance: "prob.",
    source: "venue",
    time: "year",
    impact: "#citation",
    description: "abstract",
    relationWeight: "extend prob.",
    sourceEntity: "cited paper",
    targetEntity: "citing paper",
    relationContext: "citation context",
    listName: "Paper Name",
    listImpact: "#Citation",
    polygenView: "Polygen View",
    normalView: "Normal View",
    zoomIn: "Zoom In",
    zoomOut: "Zoom Out",
    fullscreen: "Fullscreen",
    moreTools: "More Tools",
    downloadSvg: "Download SVG",
    viewModeScroll: "View Mode: GeneticFlow",
    visualizationGuide: "Visualization Guide",
    refresh: "Refresh",
    showTag: "Show Tag",
    regularNodeShape: "Regular Node Shape",
    collapse: "Collapse",
    enlargeNode: "Enlarge Node",
    showTagCloud: "Show Tag Cloud",
    hideFlowMap: "Hide FlowMap",
    fullSize: "Full Size",
};
let prismVizLabels = {...PRISMVIZ_DEFAULT_LABELS};
let prismVizFilterVisibility = PRISMVIZ_FILTER_CONTROL_KEYS.reduce((result, key) => {
    result[key] = true;
    return result;
}, {});
const PRISMVIZ_DEFAULT_SCROLL_OPTIONS = {
    layoutMode: "layered-time",
    scrollRenderer: "layered-scroll",
    showStreams: true,
    showContextBars: true,
    showEntityLabels: true,
};
let prismVizScrollOptions = {...PRISMVIZ_DEFAULT_SCROLL_OPTIONS};

function setActiveEntities(nextEntities) {
    global_entities = nextEntities;
    global_nodes = global_entities;
    return global_entities;
}

function setActiveRelations(nextRelations) {
    global_relations = nextRelations;
    global_edges = global_relations;
    return global_relations;
}

function setActiveSlices(nextSlices) {
    global_slices = nextSlices;
    global_paper_field = global_slices;
    return global_slices;
}

function setActiveEntitySliceMap(nextMap) {
    entityIdToSliceId = nextMap || {};
    paperID2topic = entityIdToSliceId;
    return entityIdToSliceId;
}

function setActiveEntityTimeMap(nextMap) {
    entityIdToTime = nextMap || {};
    paperID2year = entityIdToTime;
    return entityIdToTime;
}

function setActiveSliceGraphs(nextGraphs) {
    sliceGraphs = nextGraphs || {};
    topic2graph = sliceGraphs;
    return sliceGraphs;
}

function getActiveEntities() {
    return Array.isArray(global_entities)
        ? global_entities
        : (Array.isArray(global_nodes) ? global_nodes : []);
}

function getActiveRelations() {
    return Array.isArray(global_relations)
        ? global_relations
        : (Array.isArray(global_edges) ? global_edges : []);
}

function getActiveSlices() {
    return Array.isArray(global_slices)
        ? global_slices
        : (Array.isArray(global_paper_field) ? global_paper_field : []);
}

function getActiveSliceRelationMatrix() {
    return Array.isArray(sliceRelationMatrix)
        ? sliceRelationMatrix
        : (Array.isArray(adjacentMatrix) ? adjacentMatrix : []);
}

function getActiveEntitySliceMap() {
    return entityIdToSliceId && Object.keys(entityIdToSliceId).length > 0
        ? entityIdToSliceId
        : paperID2topic;
}

function getActiveEntityTimeMap() {
    return entityIdToTime && Object.keys(entityIdToTime).length > 0
        ? entityIdToTime
        : paperID2year;
}

function getActiveSliceGraphs() {
    if (sliceGraphs && typeof sliceGraphs === "object" && Object.keys(sliceGraphs).length > 0) {
        return sliceGraphs;
    }
    return topic2graph || {};
}

function getActiveSliceGraph(sliceId) {
    const graphs = getActiveSliceGraphs();
    const nextGraph = sliceId == null ? (graphs[String(sliceId)] || graphs[sliceId]) : (graphs[String(sliceId)] || graphs[sliceId]);
    return typeof syncScrollGraphAliases === "function" ? syncScrollGraphAliases(nextGraph) : nextGraph;
}

function setActiveSliceGraph(sliceId, nextGraph) {
    const key = String(sliceId);
    if (!sliceGraphs || typeof sliceGraphs !== "object") setActiveSliceGraphs({});
    const normalizedGraph = typeof syncScrollGraphAliases === "function" ? syncScrollGraphAliases(nextGraph) : nextGraph;
    sliceGraphs[key] = normalizedGraph;
    topic2graph[key] = normalizedGraph;
}

function findActiveSlice(sliceId) {
    if (sliceId == null) return null;
    return getActiveSlices().find(slice => String(slice.id) === String(sliceId)) || null;
}

function setSelectedSliceId(sliceId) {
    selectedSliceId = sliceId == null ? null : String(sliceId);
    STopic = selectedSliceId;
    return selectedSliceId;
}

function getSelectedSliceId() {
    if (selectedSliceId != null) return selectedSliceId;
    return STopic == null ? null : String(STopic);
}

function setFocusedSliceIndex(index) {
    const nextIndex = Number(index);
    focusedSliceIndex = Number.isFinite(nextIndex) ? nextIndex : -1;
    currentIndex = focusedSliceIndex;
    return focusedSliceIndex;
}

function getFocusedSliceIndex() {
    if (Number.isFinite(focusedSliceIndex)) return focusedSliceIndex;
    return Number.isFinite(currentIndex) ? currentIndex : -1;
}

function resetSliceAngleRanges() {
    sliceAngleRanges = [];
    topicRanges = sliceAngleRanges;
    return sliceAngleRanges;
}

function getSliceAngleRanges() {
    return sliceAngleRanges;
}

function addSliceAngleRange(range) {
    sliceAngleRanges.push(range);
    return range;
}

function normalizeViewMode(mode) {
    return mode === "Scroll" || mode === "GeneticFlow" ? "Scroll" : "Prism";
}

function setViewMode(mode) {
    viewMode = normalizeViewMode(mode);
    visType = viewMode === "Scroll" ? "GeneticFlow" : "GeneticPrism";
    return viewMode;
}

function getViewMode() {
    return normalizeViewMode(viewMode || visType);
}

function isScrollViewMode() {
    return getViewMode() === "Scroll";
}

const bookPaths = [
    "M7839 2240c-925,-5 -2039,107 -2730,790l0 4524c695,-556 1874,-651 2730,-642l0 -4672z",
    "M2161 2240l0 4672c950,-10 1934,71 2730,642l0 -4524c-691,-683 -1806,-795 -2730,-790z",
    "M2052 7132c-60,0 -109,-49 -109,-110l0 -3905 -421 60 17 4469c1041,-233 2267,-363 3261,112 -765,-557 -1826,-674 -2748,-626z",
    "M8478 3200l-421 -77 0 3899c0,61 -49,110 -109,110 -908,-47 -2004,71 -2752,628 994,-469 2245,-315 3282,-79l0 -4481z"
];
const bookWidth = 10000;
const bookHeight = 12500;

const tanh = x => Math.tanh(x);
const sech2 = x => 1 / (Math.cosh(x) ** 2);
const inverse = r => Math.sign(r) * Math.acosh(0.5 * r * r + 1);

// 全局配置对象
let filterConfig = {
    node_prob: 0.5,
    edge_prob: 0.5,
    topic_prob: 0.5,
    yearGrid: 2
};
function cloneJSON(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
}

function hasCjkText(value) {
    return /[\u3400-\u9fff]/.test(String(value || ""));
}

function pluralizeLabel(value) {
    const text = String(value || "").trim();
    if (!text) return text;
    if (hasCjkText(text)) return text;
    const lower = text.toLowerCase();
    if (lower === "entity") return "entities";
    if (lower === "relation") return "relations";
    if (lower === "slice") return "slices";
    if (lower.endsWith("y")) return `${lower.slice(0, -1)}ies`;
    if (lower.endsWith("s")) return lower;
    return `${lower}s`;
}

function composeLabel(noun, englishSuffix, chineseSuffix) {
    const text = String(noun || "").trim();
    if (!text) return "";
    return hasCjkText(text) ? `${text}${chineseSuffix}` : `${text} ${englishSuffix}`;
}

function derivePrismVizLabels(labels = {}) {
    const input = labels || {};
    const hasSemanticLabels = Boolean(input.entity || input.relation || input.slice);
    const entity = input.entity || PRISMVIZ_DEFAULT_LABELS.entity;
    const relation = input.relation || PRISMVIZ_DEFAULT_LABELS.relation;
    const slice = input.slice || PRISMVIZ_DEFAULT_LABELS.slice;
    const entityPlural = pluralizeLabel(entity);
    const relationPlural = pluralizeLabel(relation);
    const derived = hasSemanticLabels
        ? {
            specialEntityFilter: hasCjkText(entity)
                ? `\u7279\u6b8a${entity}`
                : `special ${entityPlural}`,
            isolatedEntityFilter: hasCjkText(entity)
                ? `\u5b64\u7acb${entity}`
                : `isolated ${entityPlural}`,
            entityThreshold: hasCjkText(entity)
                ? `${entity}\u9608\u503c`
                : `#${entityPlural} (nodes)`,
            relationThreshold: hasCjkText(relation)
                ? `${relation}\u9608\u503c`
                : `#${relationPlural} (edges)`,
            sliceMembershipThreshold: hasCjkText(slice)
                ? `${slice}\u5f52\u5c5e\u9608\u503c`
                : `${String(slice).toLowerCase()} membership`,
            timeGrid: "time grid",
            sliceTree: composeLabel(slice, "Tree", "\u6811"),
            entityList: composeLabel(entity, "List", "\u5217\u8868"),
            entityInfo: composeLabel(entity, "Info", "\u4fe1\u606f"),
            relationInfo: composeLabel(relation, "Info", "\u4fe1\u606f"),
            entityId: composeLabel(entity, "ID", "ID"),
            entityName: composeLabel(entity, "Name", "\u540d\u79f0"),
            entityMeta: composeLabel(entity, "meta", "\u5143\u4fe1\u606f"),
            source: "source",
            time: "time",
            impact: "Impact",
            description: "Description",
            relationWeight: composeLabel(relation, "weight", "\u6743\u91cd"),
            sourceEntity: composeLabel(entity, "source", "\u6765\u6e90"),
            targetEntity: composeLabel(entity, "target", "\u76ee\u6807"),
            relationContext: composeLabel(relation, "context", "\u8bf4\u660e"),
            listName: composeLabel(entity, "Name", "\u540d\u79f0"),
            listImpact: "Impact",
        }
        : {};

    return {
        ...PRISMVIZ_DEFAULT_LABELS,
        ...derived,
        ...input,
    };
}

function escapeHTML(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function labelText(key, fallback = "") {
    return prismVizLabels[key] || fallback || key;
}

function applyPrismVizLabels(root = null) {
    if (typeof document === "undefined") return;
    const rootElement = root && root.nodeType ? root : document;
    const labeledElements = [];
    if (rootElement.matches && rootElement.matches("[data-prismviz-label]")) {
        labeledElements.push(rootElement);
    }
    if (rootElement.querySelectorAll) {
        labeledElements.push(...rootElement.querySelectorAll("[data-prismviz-label]"));
    }
    labeledElements.forEach(element => {
        const key = element.getAttribute("data-prismviz-label");
        const fallback = element.getAttribute("data-prismviz-label-fallback") || element.textContent;
        element.textContent = labelText(key, fallback);
    });

    const tooltipElements = [];
    if (rootElement.matches && rootElement.matches("[data-prismviz-tooltip]")) {
        tooltipElements.push(rootElement);
    }
    if (rootElement.querySelectorAll) {
        tooltipElements.push(...rootElement.querySelectorAll("[data-prismviz-tooltip]"));
    }
    tooltipElements.forEach(element => {
        const key = element.getAttribute("data-prismviz-tooltip");
        const fallback = element.getAttribute("data-prismviz-tooltip-fallback") || element.getAttribute("data-tooltip") || element.getAttribute("title") || "";
        const text = labelText(key, fallback);
        element.setAttribute("data-tooltip", text);
        element.setAttribute("title", text);
    });
}

function setPrismVizLabels(labels = {}) {
    prismVizLabels = derivePrismVizLabels(labels);
    applyPrismVizLabels();
    return {...prismVizLabels};
}

function getPrismVizLabels() {
    return {...prismVizLabels};
}

function readFilterVisibilityValue(value) {
    if (typeof value === "boolean") return value;
    if (value && typeof value === "object" && "visible" in value) return Boolean(value.visible);
    if (value === "hide" || value === "hidden" || value === "none") return false;
    if (value === "show" || value === "visible") return true;
    return undefined;
}

function normalizeFilterVisibility(config = {}) {
    const nextVisibility = {...prismVizFilterVisibility};
    const rawConfig = config || {};
    const toControlList = value => Array.isArray(value)
        ? value
        : (typeof value === "string" ? value.split(",").map(item => item.trim()).filter(Boolean) : []);
    const hiddenControls = toControlList(rawConfig.hiddenControls || rawConfig.hidden);
    const visibleControls = toControlList(rawConfig.visibleControls || rawConfig.visible);

    PRISMVIZ_FILTER_CONTROL_KEYS.forEach(key => {
        const value = readFilterVisibilityValue(rawConfig[key]);
        if (value !== undefined) nextVisibility[key] = value;
    });
    hiddenControls.forEach(key => {
        if (PRISMVIZ_FILTER_CONTROL_KEYS.includes(key)) nextVisibility[key] = false;
    });
    if (visibleControls.length > 0) {
        PRISMVIZ_FILTER_CONTROL_KEYS.forEach(key => {
            nextVisibility[key] = visibleControls.includes(key);
        });
    }

    return nextVisibility;
}

function applyPrismVizFilterVisibility(root = null) {
    if (typeof document === "undefined") return;
    const rootElement = root && root.nodeType ? root : document;
    const filterElements = [];
    if (rootElement.matches && rootElement.matches("[data-prismviz-filter]")) {
        filterElements.push(rootElement);
    }
    if (rootElement.querySelectorAll) {
        filterElements.push(...rootElement.querySelectorAll("[data-prismviz-filter]"));
    }
    filterElements.forEach(element => {
        const key = element.getAttribute("data-prismviz-filter");
        const visible = prismVizFilterVisibility[key] !== false;
        element.style.display = visible ? "" : "none";
    });
}

function setPrismVizFilterVisibility(config = {}) {
    prismVizFilterVisibility = normalizeFilterVisibility(config);
    applyPrismVizFilterVisibility();
    return {...prismVizFilterVisibility};
}

function getPrismVizFilterVisibility() {
    return {...prismVizFilterVisibility};
}

function normalizeScrollLayoutMode(mode = "layered-time") {
    const normalizedMode = String(mode || "layered-time").trim().toLowerCase();
    const aliases = {
        "layered": "layered-time",
        "layered-scroll": "layered-time",
        "time": "layered-time",
        "timeline": "layered-time",
        "year": "layered-time",
        "explicit": "layered-explicit",
        "layer": "layered-explicit",
        "free": "free-layout",
        "free-layout": "free-layout",
        "graph": "free-layout",
        "force": "free-layout",
        "force-graph": "free-layout",
        "custom": "custom-layout",
        "custom-layout": "custom-layout",
    };
    return aliases[normalizedMode] || normalizedMode || "layered-time";
}

function isLayeredScrollLayout(layoutMode = prismVizScrollOptions.layoutMode) {
    return PRISMVIZ_LAYERED_LAYOUT_MODES.has(normalizeScrollLayoutMode(layoutMode));
}

function normalizePrismVizScrollOptions(...sources) {
    const merged = {
        ...PRISMVIZ_DEFAULT_SCROLL_OPTIONS,
    };
    let hasExplicitLayoutMode = false;

    sources.forEach(source => {
        if (!source || typeof source !== "object") return;
        const scroll = source.scroll && typeof source.scroll === "object" ? source.scroll : {};
        if (scroll.layoutMode !== undefined || source.layoutMode !== undefined) {
            hasExplicitLayoutMode = true;
        }
        Object.assign(merged, scroll);
        ["layoutMode", "scrollRenderer", "showStreams", "showContextBars", "showEntityLabels", "withContext"].forEach(key => {
            if (source[key] !== undefined) merged[key] = source[key];
        });
    });

    if (merged.scrollRenderer === "force-graph" && !hasExplicitLayoutMode) {
        merged.layoutMode = "free-layout";
    }
    merged.layoutMode = normalizeScrollLayoutMode(merged.layoutMode);
    merged.scrollRenderer = merged.scrollRenderer || (isLayeredScrollLayout(merged.layoutMode) ? "layered-scroll" : "graph");

    const isLayered = isLayeredScrollLayout(merged.layoutMode);
    if (!isLayered) {
        merged.showStreams = false;
        merged.showContextBars = false;
        merged.withContext = false;
    } else {
        merged.showStreams = merged.showStreams !== false;
        merged.showContextBars = merged.showContextBars !== false;
        merged.withContext = merged.withContext !== false && merged.showContextBars;
    }

    return merged;
}

function setPrismVizScrollOptions(options = {}) {
    prismVizScrollOptions = normalizePrismVizScrollOptions(options);
    return {...prismVizScrollOptions};
}

function getPrismVizScrollOptions(options = {}, model = {}) {
    return normalizePrismVizScrollOptions(
        globalConfig || {},
        globalComponentOptions || {},
        prismVizScrollOptions || {},
        model || {},
        options || {}
    );
}

function shouldRenderScrollContext(scrollOptions = prismVizScrollOptions) {
    return isLayeredScrollLayout(scrollOptions.layoutMode)
        && scrollOptions.withContext !== false
        && scrollOptions.showContextBars !== false;
}

function normalizeElementSelector(elementId = "") {
    if (typeof elementId !== "string" || elementId.trim() === "") return "";
    const trimmed = elementId.trim();
    return trimmed.startsWith("#") || trimmed.startsWith(".") ? trimmed : `#${trimmed}`;
}

function normalizeElementId(elementId = "") {
    if (typeof elementId !== "string") return "";
    const trimmed = elementId.trim();
    return trimmed.startsWith("#") ? trimmed.slice(1) : trimmed;
}

function getOrCreateElementId(selection, prefix = "prismviz") {
    let id = selection.attr("id");
    if (!id) {
        id = `${prefix}-${++standalonePanelCounter}`;
        selection.attr("id", id);
    }
    return id;
}

function isPlainObject(value) {
    return value != null && typeof value === "object" && !Array.isArray(value);
}

function extractContainerIds(options = {}) {
    const ids = {
        ...(options.containers || {}),
        ...(options.containerIds || {}),
    };
    const aliases = {
        mainPanel: ["mainPanelId", "mainPanelContainerId"],
        drawArea: ["drawAreaId", "drawAreaContainerId"],
        prismPanel: ["prismPanelId", "prismContainerPanelId"],
        scrollPanel: ["scrollPanelId", "scrollContainerId"],
        tagCloud: ["tagCloudId", "tagCloudContainerId", "sliceTagPanelId"],
        prismContainer: ["prismContainerId"],
        prism: ["prismId"],
        chordPanel: ["chordPanelId", "chordContainerId"],
        chordContent: ["chordContentId", "chordContentContainerId"],
        listPanel: ["listPanelId", "listContainerId"],
    };

    Object.entries(aliases).forEach(([key, names]) => {
        names.forEach(name => {
            if (options[name] != null) ids[key] = options[name];
        });
    });

    return Object.fromEntries(
        Object.entries(ids)
            .filter(([, value]) => typeof value === "string" && value.trim() !== "")
            .map(([key, value]) => [key, normalizeElementId(value)])
    );
}

function configurePrismVizContainers(options = {}, overrides = {}, reset = false) {
    const nextIds = reset
        ? {...PRISMVIZ_DEFAULT_CONTAINER_IDS}
        : {...prismVizContainerIds};
    prismVizContainerIds = {
        ...nextIds,
        ...extractContainerIds(options),
        ...Object.fromEntries(
            Object.entries(overrides)
                .filter(([, value]) => typeof value === "string" && value.trim() !== "")
                .map(([key, value]) => [key, normalizeElementId(value)])
        ),
    };
    chordPanelElementId = prismVizContainerIds.chordPanel || chordPanelElementId;
    chordContentSelector = getContainerSelector("chordContent");
    return prismVizContainerIds;
}

function getContainerId(key) {
    return prismVizContainerIds[key] || PRISMVIZ_DEFAULT_CONTAINER_IDS[key] || "";
}

function getLegacyContainerId(key) {
    return PRISMVIZ_LEGACY_CONTAINER_IDS[key] || "";
}

function getResolvedContainerId(key) {
    const id = getContainerId(key);
    if (typeof document !== "undefined" && id && document.getElementById(id)) return id;
    const legacyId = getLegacyContainerId(key);
    if (typeof document !== "undefined" && legacyId && document.getElementById(legacyId)) return legacyId;
    return id || legacyId;
}

function getContainerSelector(key) {
    return normalizeElementSelector(getResolvedContainerId(key));
}

function getContainerElement(key) {
    const id = getResolvedContainerId(key);
    return id ? document.getElementById(id) : null;
}

function resolvePanelElementArgs(elementOrOptions, options = {}, fallbackKey = "mainPanel") {
    if (isPlainObject(elementOrOptions)) {
        const nextOptions = {...elementOrOptions, ...options};
        return {
            elementId: nextOptions.containerId || nextOptions.elementId || getContainerId(fallbackKey),
            options: nextOptions,
        };
    }
    return {
        elementId: elementOrOptions || getContainerId(fallbackKey),
        options,
    };
}

function getRotationSpeedForLevel(level = speedLevel) {
    const nextLevel = Math.max(0, Math.min(speedValues.length - 1, parseInt(level, 10) || 0));
    return speedValues[nextLevel];
}

function syncRotationSpeedUI() {
    const speed = speedMultipliers[speedLevel];
    $("#rotation-speed-label").text(`${speed}x`);
    $("#rotation-speed-slider").val(speedLevel);
    $("#speed").attr("data-tooltip", `Rotation Speed: ${speed}x`);
}

function setRotationSpeedLevel(level) {
    const nextLevel = Math.max(0, Math.min(speedMultipliers.length - 1, parseInt(level, 10) || 0));
    speedLevel = nextLevel;
    rotationSpeed = getRotationSpeedForLevel(speedLevel);
    syncRotationSpeedUI();
}

function syncTagScaleUI() {
    $("#tag-scale-label").text(`${tagScalePercent}%`);
    $("#tag-scale-slider").val(tagScalePercent);
}

function setTagScalePercent(value) {
    const nextValue = Math.max(60, Math.min(100, parseInt(value, 10) || 100));
    tagScalePercent = nextValue;
    syncTagScaleUI();
    drawSliceTags();
}

function getSliceMeta(sliceId) {
    return globalFieldMeta[String(sliceId)] || {};
}

const getFieldMeta = getSliceMeta;

function fallbackChordLabel(label) {
    const text = String(label || "");
    const chineseChars = Array.from(text).filter(char => /[\u4e00-\u9fff]/.test(char));
    if (chineseChars.length >= 2) return chineseChars.slice(0, 2).join("");
    if (chineseChars.length === 1) return chineseChars[0] + chineseChars[0];

    const compact = text.replace(/\s+/g, "");
    return compact.slice(0, 2) || text.slice(0, 2);
}

function getSliceLabelText(slice, mode = "default") {
    if (!slice) return "";
    if (mode === "chord") {
        return slice.chordName || getSliceMeta(slice.id).chordName || fallbackChordLabel(slice.shortName || slice.name);
    }
    return slice.shortName || slice.name || "";
}

function getTopicLabelText(topic, mode = "default") {
    return getSliceLabelText(topic, mode);
}
// Legacy domain field names are intentionally accepted at this adapter boundary.
// Downstream model/component code should prefer entity/relation/slice fields.
const PRISMVIZ_DEFAULT_SCHEMA = {
    entity: {
        id: ["id", "entityId", "nodeId", "paperID"],
        label: ["label", "name", "title"],
        time: ["time", "year"],
        primarySliceId: ["primarySliceId", "sliceId", "topic", "field"],
        sliceWeights: ["sliceWeights", "topicDist"],
        importance: ["importance", "isKeyPaper", "prob"],
        impact: ["impact", "citationCount"],
        description: ["description", "abstract"],
        authors: ["authors", "meta.authors"],
        venue: ["venue", "venu", "meta.venue"],
        survey: ["survey", "meta.survey"],
        meta: ["meta"],
    },
    relation: {
        id: ["id", "relationId", "edgeId"],
        source: ["source", "sourceId", "from"],
        target: ["target", "targetId", "to"],
        weight: ["weight", "extends_prob", "prob"],
        description: ["description", "citation_context", "context"],
        time: ["time", "year"],
        type: ["type", "relationType"],
        meta: ["meta"],
    },
    slice: {
        id: ["id", "sliceId", "Topic", "topicId"],
        name: ["name", "sliceName", "Name"],
        shortName: ["shortName", "chordName"],
        chordName: ["shortName", "chordName"],
        fullName: ["fullName"],
        size: ["size", "Count", "count"],
        color: ["color"],
    },
    hierarchy: {
        id: ["id", "sliceId", "Topic"],
        parentId: ["parentId", "parentTopic"],
        level: ["level"],
        isLeaf: ["isLeaf"],
        type: ["type", "nodeType"],
        name: ["name", "Name"],
    },
    config: {
        entityThreshold: ["entityThreshold", "node_prob"],
        relationThreshold: ["relationThreshold", "edge_prob"],
        sliceThreshold: ["sliceThreshold", "topic_prob"],
        timeGrid: ["timeGrid", "yearGrid"],
        sliceWeightTopK: ["sliceWeightTopK", "slice_weights_top_k", "topicTopK", "topic_top_k"],
    },
};

function mergePrismVizSchema(customSchema = {}) {
    const schema = {};
    Object.keys(PRISMVIZ_DEFAULT_SCHEMA).forEach(group => {
        schema[group] = {
            ...PRISMVIZ_DEFAULT_SCHEMA[group],
            ...(customSchema[group] || {}),
        };
    });
    return schema;
}

function isDefinedValue(value) {
    return value !== undefined && value !== null;
}

function getValueByPath(object, path) {
    if (!object || typeof path !== "string") return undefined;
    if (Object.prototype.hasOwnProperty.call(object, path)) return object[path];
    return path.split(".").reduce((current, key) => {
        if (!isDefinedValue(current)) return undefined;
        return current[key];
    }, object);
}

function getValueBySpec(object, spec) {
    if (typeof spec === "function") return spec(object);
    if (Array.isArray(spec)) {
        for (const item of spec) {
            const value = getValueBySpec(object, item);
            if (isDefinedValue(value)) return value;
        }
        return undefined;
    }
    return getValueByPath(object, spec);
}

function getMappedValue(object, schemaGroup, key) {
    return getValueBySpec(object, schemaGroup[key]);
}

function toStringOrNull(value) {
    return isDefinedValue(value) && value !== "" ? String(value) : null;
}

function toNumberOrDefault(value, fallback = 0) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : fallback;
}

function toBooleanOrDefault(value, fallback = false) {
    if (!isDefinedValue(value)) return fallback;
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value !== 0;
    const normalized = String(value).trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) return true;
    if (["false", "0", "no", "n", ""].includes(normalized)) return false;
    return fallback;
}

function normalizeSliceWeights(value, primarySliceId = null) {
    const weights = {};
    if (Array.isArray(value)) {
        value.forEach(item => {
            if (Array.isArray(item)) {
                const [id, weight] = item;
                if (isDefinedValue(id)) weights[String(id)] = toNumberOrDefault(weight, 0);
                return;
            }
            if (item && typeof item === "object") {
                const id = item.id ?? item.sliceId ?? item.topicId ?? item.Topic;
                const weight = item.weight ?? item.value ?? item.prob ?? item.score ?? 1;
                if (isDefinedValue(id)) weights[String(id)] = toNumberOrDefault(weight, 0);
            }
        });
    } else if (value && typeof value === "object") {
        Object.keys(value).forEach(id => {
            weights[String(id)] = toNumberOrDefault(value[id], 0);
        });
    }

    if (Object.keys(weights).length === 0 && primarySliceId != null) {
        weights[String(primarySliceId)] = 1;
    }
    return weights;
}

function limitSliceWeights(sliceWeights = {}, topK = 3, primarySliceId = null) {
    const limit = parseInt(topK, 10);
    const normalizedWeights = {...(sliceWeights || {})};
    if (primarySliceId != null && !Object.prototype.hasOwnProperty.call(normalizedWeights, String(primarySliceId))) {
        normalizedWeights[String(primarySliceId)] = 1;
    }
    if (!Number.isFinite(limit) || limit <= 0) return normalizedWeights;

    return Object.entries(normalizedWeights)
        .sort((a, b) => toNumberOrDefault(b[1], 0) - toNumberOrDefault(a[1], 0))
        .slice(0, limit)
        .reduce((result, [sliceId, weight]) => {
            result[String(sliceId)] = toNumberOrDefault(weight, 0);
            return result;
        }, {});
}

function normalizeEntity(rawEntity = {}, schema) {
    const entitySchema = schema.entity;
    const id = toStringOrNull(getMappedValue(rawEntity, entitySchema, "id"));
    const label = getMappedValue(rawEntity, entitySchema, "label") ?? id ?? "";
    const time = getMappedValue(rawEntity, entitySchema, "time");
    const primarySliceId = toStringOrNull(getMappedValue(rawEntity, entitySchema, "primarySliceId"));
    const sliceWeights = normalizeSliceWeights(
        getMappedValue(rawEntity, entitySchema, "sliceWeights"),
        primarySliceId
    );
    const metaValue = getMappedValue(rawEntity, entitySchema, "meta");
    const meta = metaValue && typeof metaValue === "object" ? {...metaValue} : {};
    const description = getMappedValue(rawEntity, entitySchema, "description") ?? "";
    const authors = getMappedValue(rawEntity, entitySchema, "authors") ?? "";
    const venue = getMappedValue(rawEntity, entitySchema, "venue") ?? "";
    const impact = getMappedValue(rawEntity, entitySchema, "impact");
    const importance = getMappedValue(rawEntity, entitySchema, "importance");
    const survey = getMappedValue(rawEntity, entitySchema, "survey");

    return {
        ...rawEntity,
        id,
        entityId: id,
        name: String(label),
        label: String(label),
        year: toNumberOrDefault(time, 0),
        time: toNumberOrDefault(time, 0),
        topic: primarySliceId,
        primarySliceId,
        topicDist: sliceWeights,
        sliceWeights,
        isKeyPaper: toNumberOrDefault(importance, 1),
        importance: toNumberOrDefault(importance, 1),
        citationCount: isDefinedValue(impact) ? impact : 0,
        impact: isDefinedValue(impact) ? impact : 0,
        abstract: description,
        description,
        authors,
        venu: venue,
        venue,
        survey: toBooleanOrDefault(survey, false),
        meta,
        original: rawEntity,
    };
}

function normalizeRelation(rawRelation = {}, schema) {
    const relationSchema = schema.relation;
    const source = toStringOrNull(getMappedValue(rawRelation, relationSchema, "source"));
    const target = toStringOrNull(getMappedValue(rawRelation, relationSchema, "target"));
    const id = toStringOrNull(getMappedValue(rawRelation, relationSchema, "id")) || `${source}->${target}`;
    const weight = getMappedValue(rawRelation, relationSchema, "weight");
    const description = getMappedValue(rawRelation, relationSchema, "description") ?? "";
    const relationType = getMappedValue(rawRelation, relationSchema, "type") ?? rawRelation.relationType ?? "relation";
    const metaValue = getMappedValue(rawRelation, relationSchema, "meta");
    const meta = metaValue && typeof metaValue === "object" ? {...metaValue} : {};

    return {
        ...rawRelation,
        id,
        relationId: id,
        name: rawRelation.name || `${source}->${target}`,
        source,
        target,
        sourceId: source,
        targetId: target,
        extends_prob: toNumberOrDefault(weight, 1),
        weight: toNumberOrDefault(weight, 1),
        citation_context: description,
        description,
        time: getMappedValue(rawRelation, relationSchema, "time"),
        relationType,
        type: relationType,
        meta,
        original: rawRelation,
    };
}

function normalizeSliceDictionary(fields = {}, data = {}, fieldMeta = {}, schema) {
    const sliceSchema = schema.slice;
    const normalizedFields = {};
    const normalizedFieldMeta = {};
    const rawSlices = Array.isArray(data?.slices)
        ? data.slices
        : Array.isArray(fields)
            ? fields
            : null;

    if (rawSlices) {
        rawSlices.forEach(slice => {
            const id = toStringOrNull(getMappedValue(slice, sliceSchema, "id"));
            if (id == null) return;
            const name = getMappedValue(slice, sliceSchema, "name") ?? id;
            const compactName = getMappedValue(slice, sliceSchema, "shortName")
                ?? getMappedValue(slice, sliceSchema, "chordName")
                ?? fieldMeta?.[id]?.chordName
                ?? fieldMeta?.[id]?.shortName
                ?? fallbackChordLabel(name);
            normalizedFields[id] = String(name);
            normalizedFieldMeta[id] = {
                ...(fieldMeta?.[id] || {}),
                shortName: compactName,
                chordName: compactName,
                fullName: getMappedValue(slice, sliceSchema, "fullName") ?? fieldMeta?.[id]?.fullName ?? String(name),
                size: getMappedValue(slice, sliceSchema, "size") ?? fieldMeta?.[id]?.size,
                color: getMappedValue(slice, sliceSchema, "color") ?? fieldMeta?.[id]?.color,
            };
        });
        Object.keys(fieldMeta || {}).forEach(id => {
            if (!normalizedFieldMeta[id]) normalizedFieldMeta[id] = fieldMeta[id];
        });
        return {
            fields: normalizedFields,
            fieldMeta: normalizedFieldMeta,
        };
    }

    Object.keys(fields || {}).forEach(id => {
        const value = fields[id];
        const metaFromValue = value && typeof value === "object" ? value : {};
        const name = typeof value === "object"
            ? (value.name || value.sliceName || value.Name || id)
            : value;
        normalizedFields[String(id)] = String(name);
        normalizedFieldMeta[String(id)] = {
            ...(fieldMeta?.[String(id)] || {}),
            ...metaFromValue,
            shortName: metaFromValue.shortName
                || metaFromValue.chordName
                || fieldMeta?.[String(id)]?.shortName
                || fieldMeta?.[String(id)]?.chordName
                || String(name),
            chordName: metaFromValue.chordName
                || metaFromValue.shortName
                || fieldMeta?.[String(id)]?.chordName
                || fieldMeta?.[String(id)]?.shortName
                || fallbackChordLabel(name),
            fullName: metaFromValue.fullName || fieldMeta?.[String(id)]?.fullName || String(name),
        };
    });
    Object.keys(fieldMeta || {}).forEach(id => {
        if (!normalizedFieldMeta[id]) normalizedFieldMeta[id] = fieldMeta[id];
    });

    return {
        fields: normalizedFields,
        fieldMeta: normalizedFieldMeta,
    };
}

function normalizeConfig(config = {}, schema) {
    const configSchema = schema.config;
    const entityThreshold = getMappedValue(config, configSchema, "entityThreshold");
    const relationThreshold = getMappedValue(config, configSchema, "relationThreshold");
    const sliceThreshold = getMappedValue(config, configSchema, "sliceThreshold");
    const timeGrid = getMappedValue(config, configSchema, "timeGrid");
    const sliceWeightTopK = getMappedValue(config, configSchema, "sliceWeightTopK");

    return {
        ...(config || {}),
        node_prob: toNumberOrDefault(entityThreshold, toNumberOrDefault(config.node_prob, filterConfig.node_prob)),
        edge_prob: toNumberOrDefault(relationThreshold, toNumberOrDefault(config.edge_prob, filterConfig.edge_prob)),
        topic_prob: toNumberOrDefault(sliceThreshold, toNumberOrDefault(config.topic_prob, filterConfig.topic_prob)),
        yearGrid: toNumberOrDefault(timeGrid, toNumberOrDefault(config.yearGrid, filterConfig.yearGrid)),
        entityThreshold: toNumberOrDefault(entityThreshold, toNumberOrDefault(config.node_prob, filterConfig.node_prob)),
        relationThreshold: toNumberOrDefault(relationThreshold, toNumberOrDefault(config.edge_prob, filterConfig.edge_prob)),
        sliceThreshold: toNumberOrDefault(sliceThreshold, toNumberOrDefault(config.topic_prob, filterConfig.topic_prob)),
        timeGrid: toNumberOrDefault(timeGrid, toNumberOrDefault(config.yearGrid, filterConfig.yearGrid)),
        sliceWeightTopK: toNumberOrDefault(sliceWeightTopK, toNumberOrDefault(config.sliceWeightTopK, 3)),
    };
}

function normalizeSliceHierarchyRows(rows = [], options = {}) {
    const schema = mergePrismVizSchema(options.schema || options.fieldMap || {});
    const hierarchySchema = schema.hierarchy;

    return (rows || []).map(row => {
        const id = toStringOrNull(getMappedValue(row, hierarchySchema, "id"));
        const parentId = toStringOrNull(getMappedValue(row, hierarchySchema, "parentId")) || "-1";
        const level = parseInt(getMappedValue(row, hierarchySchema, "level") ?? 0, 10);
        const isLeaf = toBooleanOrDefault(
            getMappedValue(row, hierarchySchema, "isLeaf"),
            toBooleanOrDefault(row?.meta?.originalIsLeaf, false)
        );
        const type = getMappedValue(row, hierarchySchema, "type")
            || row?.meta?.originalNodeType
            || (isLeaf ? "slice" : "group");
        const name = getMappedValue(row, hierarchySchema, "name") ?? id;

        return {
            ...row,
            id,
            parentId,
            name,
            type,
            Topic: id,
            parentTopic: parentId,
            Name: name,
            level: Number.isFinite(level) ? level : 0,
            isLeaf,
            nodeType: type,
        };
    });
}

function normalizeComponentOptionsToConfig(componentOptions = {}, baseConfig = {}) {
    const filters = componentOptions?.filters || {};
    const prism = componentOptions?.prism || {};
    const scroll = componentOptions?.scroll || {};

    const isolatedEntityFilter = filters.isolatedEntityFilter;
    const specialEntityFilter = filters.specialEntityFilter;

    return {
        ...(baseConfig || {}),
        ...(componentOptions?.config || {}),
        layoutMode: componentOptions?.layoutMode ?? baseConfig?.layoutMode ?? "layered-time",
        scrollRenderer: componentOptions?.scrollRenderer ?? baseConfig?.scrollRenderer ?? "layered-scroll",
        sliceWeightTopK: componentOptions?.sliceWeightTopK,
        node_prob: filters.entityImportanceThreshold ?? baseConfig?.node_prob,
        edge_prob: filters.relationWeightThreshold ?? baseConfig?.edge_prob,
        topic_prob: filters.sliceMembershipThreshold ?? baseConfig?.topic_prob,
        yearGrid: filters.timeGrid ?? filters.layerGrid ?? baseConfig?.yearGrid,
        remove_isolated: isolatedEntityFilter === "exclude"
            ? "1"
            : isolatedEntityFilter === "partial"
                ? "2"
                : isolatedEntityFilter === "include"
                    ? "0"
                    : baseConfig?.remove_isolated,
        remove_survey: specialEntityFilter === "exclude"
            ? "1"
            : specialEntityFilter === "include"
                ? "0"
                : baseConfig?.remove_survey,
        prism,
        scroll: {
            ...(baseConfig?.scroll || {}),
            ...scroll,
        },
        labels: componentOptions?.labels || baseConfig?.labels,
    };
}

function unpackPrismVizInputPackage(data = {}, fields = {}, config = {}, options = {}) {
    const componentData = data?.componentData || options.componentData;
    const hasPackageShape = componentData
        || data?.entityDefinitions
        || data?.relationDefinitions
        || data?.sliceDefinitions;

    if (!hasPackageShape) {
        return {
            data,
            fields,
            config,
            fieldMeta: options.fieldMeta || {},
            treeRows: options.treeRows || null,
            displayInfo: options.displayInfo || null,
            componentOptions: options.componentOptions || null,
        };
    }

    const componentOptions = data?.componentOptions || options.componentOptions || {};
    const displayInfo = data?.displayInfo || options.displayInfo || {};
    const sliceInfoById = displayInfo?.sliceInfoById || {};
    const sliceDefinitions = componentData?.sliceDefinitions || data?.sliceDefinitions || data?.slices || fields || [];
    const entityDefinitions = componentData?.entityDefinitions || data?.entityDefinitions || data?.entities || data?.nodes || [];
    const relationDefinitions = componentData?.relationDefinitions || data?.relationDefinitions || data?.relations || data?.edges || [];
    const sliceHierarchy = componentData?.sliceHierarchy || data?.sliceHierarchy || options.treeRows || [];
    const fieldMetaFromDisplayInfo = Object.keys(sliceInfoById).reduce((result, id) => {
        const item = sliceInfoById[id] || {};
        result[String(id)] = {
            shortName: item.shortName,
            chordName: item.shortName,
            fullName: item.description || item.fullName,
            ...item,
        };
        return result;
    }, {});

    return {
        data: {
            ...(data || {}),
            nodes: entityDefinitions,
            edges: relationDefinitions,
            entities: entityDefinitions,
            relations: relationDefinitions,
            slices: sliceDefinitions,
            displayInfo,
            componentOptions,
        },
        fields: Array.isArray(fields) || Object.keys(fields || {}).length > 0
            ? fields
            : sliceDefinitions,
        config: normalizeComponentOptionsToConfig(componentOptions, config),
        fieldMeta: {
            ...fieldMetaFromDisplayInfo,
            ...(options.fieldMeta || {}),
        },
        treeRows: sliceHierarchy,
        displayInfo,
        componentOptions,
    };
}

function normalizePrismVizInput(data = {}, fields = {}, config = {}, options = {}) {
    const unpackedInput = unpackPrismVizInputPackage(data, fields, config, options);
    data = unpackedInput.data;
    fields = unpackedInput.fields;
    config = unpackedInput.config;
    options = {
        ...options,
        fieldMeta: unpackedInput.fieldMeta,
        treeRows: unpackedInput.treeRows,
        displayInfo: unpackedInput.displayInfo,
        componentOptions: unpackedInput.componentOptions,
    };
    const schema = mergePrismVizSchema(options.schema || options.fieldMap || {});
    const fieldMeta = options.fieldMeta || {};
    const normalizedConfig = normalizeConfig(config, schema);
    const sliceWeightTopK = normalizedConfig.sliceWeightTopK;
    const rawEntities = data?.entities || data?.nodes || [];
    const rawRelations = data?.relations || data?.edges || [];
    const entities = rawEntities
        .map(entity => normalizeEntity(entity, schema))
        .map(entity => {
            const sliceWeights = limitSliceWeights(entity.sliceWeights, sliceWeightTopK, entity.primarySliceId);
            return {
                ...entity,
                topicDist: sliceWeights,
                sliceWeights,
            };
        })
        .filter(entity => entity.id != null);
    const relations = rawRelations
        .map(relation => normalizeRelation(relation, schema))
        .filter(relation => relation.source != null && relation.target != null);
    const sliceData = normalizeSliceDictionary(fields, data, fieldMeta, schema);

    return {
        data: {
            ...(data || {}),
            nodes: entities,
            edges: relations,
            entities,
            relations,
        },
        fields: sliceData.fields,
        fieldMeta: sliceData.fieldMeta,
        config: normalizedConfig,
        schema,
        treeRows: unpackedInput.treeRows,
        displayInfo: unpackedInput.displayInfo,
        componentOptions: unpackedInput.componentOptions,
    };
}
function hideFloatingTips() {
    d3.selectAll(".d3-tip")
        .style("opacity", 0)
        .style("pointer-events", "none");
}

function handleSliceTagClick(sliceId, source = "tagcloud") {
    const normalizedSliceId = String(sliceId);
    const activeSliceId = getSelectedSliceId();
    const isCurrentSlice = String(activeSliceId) === normalizedSliceId;
    const rotate = activeSliceId == null || !isCurrentSlice;
    hideFloatingTips();

    if (isScrollViewMode()) {
        if (isCurrentSlice) {
            return closeScrollToPrism(normalizedSliceId, {
                rotate: true,
                source,
            });
        }

        return openScrollForSlice(normalizedSliceId, {
            rotate: false,
            source,
        });
    }

    return openScrollForSlice(normalizedSliceId, {
        rotate,
        source,
    });
}

const handleTopicTagLikeClick = handleSliceTagClick;
function buildChordModel(options = {}) {
    const matrix = cloneJSON(options.sliceRelationMatrix || options.adjacentMatrix || getActiveSliceRelationMatrix());
    const slices = cloneJSON(options.slices || options.paperField || getActiveSlices());
    const selectedSliceId = options.selectedSliceId ?? activeSyncedSliceId ?? getSelectedSliceId() ?? null;
    return {
        adjacentMatrix: matrix,
        sliceRelationMatrix: matrix,
        paperField: slices,
        slices,
        selectedSliceId,
        polygenView: options.polygenView ?? polygenView,
    };
}

function buildSliceRelationModel(options = {}) {
    return buildChordModel(options);
}

function applyChordModel(chordModel = {}) {
    if (Array.isArray(chordModel.sliceRelationMatrix) || Array.isArray(chordModel.adjacentMatrix)) {
        sliceRelationMatrix = cloneJSON(chordModel.sliceRelationMatrix || chordModel.adjacentMatrix);
        adjacentMatrix = sliceRelationMatrix;
    }
    if (Array.isArray(chordModel.slices) || Array.isArray(chordModel.paperField)) {
        setActiveSlices(cloneJSON(chordModel.slices || chordModel.paperField));
    }
    if (typeof chordModel.polygenView === "boolean") {
        polygenView = chordModel.polygenView;
    }

    if ("selectedSliceId" in chordModel) {
        const selectedId = chordModel.selectedSliceId;
        const normalizedSliceId = selectedId == null ? null : String(selectedId);
        setFocusedSliceIndex(normalizedSliceId == null
            ? -1
            : getActiveSlices().findIndex(d => String(d.id) === normalizedSliceId));
    }
}

function syncChordSelectionBySliceId(sliceId) {
    const normalizedSliceId = sliceId == null ? null : String(sliceId);
    const previousIndex = getFocusedSliceIndex();
    const nextIndex = normalizedSliceId == null
        ? -1
        : getActiveSlices().findIndex(d => String(d.id) === normalizedSliceId);
    setFocusedSliceIndex(nextIndex);

    if (nextIndex < 0) {
        chord_arcs.style("opacity", defaultOpacity);
        chord_ribbons.style("opacity", defaultOpacity);
        return nextIndex;
    }

    highlight_arc_with_cash(nextIndex, previousIndex);
    return nextIndex;
}

function renderChordContent(elementSelector = chordContentSelector, chordModel = buildChordModel(), options = {}) {
    const selector = normalizeElementSelector(elementSelector);
    const container = d3.select(selector);

    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return null;
    }

    applyChordModel(chordModel);
    container.selectAll("*").remove();
    container
        .style("position", "relative")
        .style("overflow", "hidden")
        .style("background-color", "#f5fafa");

    if (options.square !== false) {
        const parent = container.node().parentElement;
        const sideLength = options.sideLength
            || container.node().getBoundingClientRect().width
            || (parent ? parent.getBoundingClientRect().width : 0);
        if (sideLength > 0) {
            container.style("width", `${sideLength}px`);
            container.style("height", `${sideLength}px`);
        }
    }

    const svgElement = init_chord(
        chordModel.polygenView ?? polygenView,
        options.allowInteraction !== false,
        options.drawRibbon !== false,
        options.outonly !== false,
        options.allowReaction !== false
    );

    bindSVG(svgElement, selector);
    update_chord_element();

    const selectedSliceId = chordModel.selectedSliceId;
    if (selectedSliceId != null) {
        syncChordSelectionBySliceId(selectedSliceId);
    }

    return chordModel;
}

function renderChordPanel(elementId = getContainerId("chordPanel"), chordModel = buildChordModel(), options = {}) {
    if (isPlainObject(elementId)) {
        const resolved = resolvePanelElementArgs(elementId, {}, "chordPanel");
        elementId = resolved.elementId;
        chordModel = resolved.options.chordModel || resolved.options.model || chordModel;
        options = {
            ...resolved.options,
            ...options,
        };
    }
    const selector = normalizeElementSelector(elementId);
    const container = d3.select(selector);

    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return null;
    }

    chordPanelElementId = getOrCreateElementId(container, "chord-panel");
    configurePrismVizContainers(options, {chordPanel: chordPanelElementId});
    container.selectAll("*").remove();
    container.style("position", "relative");

    if (options.showToggle !== false) {
        container.append("button")
            .attr("class", "toggle-polygen-button")
            .style("position", "absolute")
            .style("top", "10px")
            .style("left", "20px")
            .style("padding", "5px 10px")
            .text((chordModel.polygenView ?? polygenView)
                ? labelText("normalView", "Normal View")
                : labelText("polygenView", "Polygen View"))
            .on("click", function() {
                renderChordPanel(
                    `#${chordPanelElementId}`,
                    {
                        ...chordModel,
                        polygenView: !(chordModel.polygenView ?? polygenView),
                    },
                    options
                );
            });
    }

    const contentId = normalizeElementId(options.contentContainerId || options.chordContentId || options.chordContentContainerId || "") || (chordPanelElementId === getContainerId("chordPanel") || chordPanelElementId === getLegacyContainerId("chordPanel")
        ? getContainerId("chordContent")
        : `${chordPanelElementId}-content`);
    container.append("div").attr("id", contentId);
    configurePrismVizContainers(options, {chordContent: contentId});
    chordContentSelector = `#${contentId}`;

    return renderChordContent(chordContentSelector, chordModel, options);
}

function renderChord(elementId = getContainerId("chordPanel"), sliceRelationModel = buildSliceRelationModel(), options = {}) {
    return renderChordPanel(elementId, sliceRelationModel, options);
}
function buildScrollModel(sliceId = getSelectedSliceId(), options = {}) {
    const normalizedSliceId = sliceId == null ? null : String(sliceId);
    if (normalizedSliceId == null) {
        return {
            topicId: null,
            sliceId: null,
            topic: null,
            slice: null,
            graph: null,
        };
    }

    if (options.forceRebuild || !getActiveSliceGraph(normalizedSliceId)) {
        loadSliceGraph(normalizedSliceId, options);
    }

    const slice = findActiveSlice(normalizedSliceId);
    const graph = syncScrollGraphAliases(cloneJSON(getActiveSliceGraph(normalizedSliceId)));
    const scrollOptions = getPrismVizScrollOptions(options, {sliceId: normalizedSliceId});
    return {
        topicId: normalizedSliceId,
        sliceId: normalizedSliceId,
        topic: slice,
        slice,
        graph,
        layoutMode: scrollOptions.layoutMode,
        scrollRenderer: scrollOptions.scrollRenderer,
        scroll: scrollOptions,
    };
}

function renderScrollPanel(elementId = getContainerId("scrollPanel"), scrollModel = buildScrollModel(), options = {}) {
    if (isPlainObject(elementId)) {
        const secondArg = scrollModel;
        const resolved = resolvePanelElementArgs(elementId, {}, "scrollPanel");
        elementId = resolved.elementId;
        const secondArgLooksLikeModel = isPlainObject(secondArg)
            && (secondArg.graph || secondArg.sliceId != null || secondArg.topicId != null);
        scrollModel = resolved.options.scrollModel
            || resolved.options.model
            || (secondArgLooksLikeModel ? secondArg : buildScrollModel(resolved.options.sliceId ?? resolved.options.topicId, resolved.options));
        options = {
            ...resolved.options,
            ...(isPlainObject(secondArg) && !secondArgLooksLikeModel ? secondArg : {}),
            ...options,
        };
    }
    const selector = normalizeElementSelector(elementId);
    const container = d3.select(selector);

    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return null;
    }

    let model = scrollModel;
    if ((!model || !model.graph) && model && (model.topicId != null || model.sliceId != null)) {
        model = buildScrollModel(model.sliceId ?? model.topicId, {
            forceRebuild: options.forceRebuild,
        });
    }
    if (!model || !model.graph) {
        container.selectAll("*").remove();
        return null;
    }
    const modelSliceId = model.sliceId ?? model.topicId;
    const scrollOptions = getPrismVizScrollOptions(options, model);
    const renderContext = options.withContext !== false && shouldRenderScrollContext(scrollOptions);

    const previousSliceId = getSelectedSliceId();
    const previousGraph = graph;
    const previousViewMode = getViewMode();
    const previousRotationSpeed = rotationSpeed;

    configurePrismVizContainers(options, {scrollPanel: getOrCreateElementId(container, "scroll-panel")});

    const isMountedMainScroll = selector === getContainerSelector("scrollPanel")
        && container.node()?.parentElement?.id === getContainerId("drawArea");
    if (isMountedMainScroll) {
        container
            .style("position", "absolute")
            .style("top", "0")
            .style("left", "0")
            .style("right", "0")
            .style("bottom", "0")
            .style("overflow", "hidden");
    } else {
        container
            .style("position", "relative")
            .style("overflow", "hidden");
    }
    container.selectAll("*").remove();

    setSelectedSliceId(modelSliceId);
    graph = syncScrollGraphAliases(cloneJSON(model.graph));
    graph.layoutMode = scrollOptions.layoutMode;
    graph.scrollRenderer = scrollOptions.scrollRenderer;
    graph.scroll = scrollOptions;

    if (options.activateVisType !== false) {
        stopRotateToAnimation(true);
        stopPrismRotationLoop();
        setViewMode("Scroll");
        rotationSpeed = 0;
    }

    if (fullsize && options.allowFullsize !== false) {
        const node = container.node();
        graph.width = node.clientWidth / 72;
        graph.height = node.clientHeight / 72;
    } else {
        graph.width = undefined;
        graph.height = undefined;
    }

    init_graph(graph, renderContext);
    bindSVGToElement(graph, 'svg', selector);

    if (graph.sliceId != null) {
        draw_bbox(graph);
        if (renderContext && scrollOptions.showStreams !== false) {
            draw_context(graph);
        }
    }

    if (options.updateSider) {
        updateSider(graph && graph.entities ? graph.entities : undefined);
    }

    if (options.restoreState) {
        setSelectedSliceId(previousSliceId);
        graph = previousGraph;
        setViewMode(previousViewMode);
        rotationSpeed = previousRotationSpeed;
    }

    return graph;
}

function renderScroll(elementId = getContainerId("scrollPanel"), scrollModel = buildScrollModel(), options = {}) {
    return renderScrollPanel(elementId, scrollModel, options);
}

function bindScrollPanel(elementId = getContainerId("scrollPanel"), options = {}) {
    const resolved = resolvePanelElementArgs(elementId, options, "scrollPanel");
    elementId = resolved.elementId;
    options = resolved.options;
    const selector = normalizeElementSelector(elementId);
    const container = d3.select(selector);

    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return null;
    }

    configurePrismVizContainers(options, {scrollPanel: getOrCreateElementId(container, "scroll-panel")});
    container
        .style("position", options.position || "relative")
        .style("overflow", "hidden");

    if (options.model || options.scrollModel || options.sliceId || options.topicId) {
        const model = options.model
            || options.scrollModel
            || buildScrollModel(options.sliceId ?? options.topicId, {
                ...options,
                forceRebuild: options.forceRebuild,
            });
        return renderScrollPanel(getContainerId("scrollPanel"), model, options);
    }

    return container.node();
}
function loadData(data, fields, config, v, vc, fieldMeta = {}, options = {}) {
    const normalizedInput = normalizePrismVizInput(data, fields, config, {
        ...options,
        fieldMeta,
    });
    globalFields = normalizedInput.fields;
    globalFieldMeta = normalizedInput.fieldMeta || {};
    authorData = normalizedInput.data;
    globalConfig = normalizedInput.config;
    globalDisplayInfo = normalizedInput.displayInfo || {};
    globalComponentOptions = normalizedInput.componentOptions || {};
    globalTreeRows = normalizedInput.treeRows || null;
    setPrismVizLabels(globalConfig.labels || globalComponentOptions.labels || {});
    setPrismVizScrollOptions(globalConfig || globalComponentOptions || {});
    setPrismVizFilterVisibility(
        globalComponentOptions.filterVisibility
        || globalComponentOptions.filterControls
        || globalComponentOptions?.ui?.filterVisibility
        || globalComponentOptions?.ui?.filterControls
        || globalConfig.filterVisibility
        || globalConfig.filterControls
        || {}
    );
    viz = v;
    vizContext = vc;
    // 遍历filterConfig的键，如果globalConfig中有对应的键，则更新filterConfig
    for (let key in filterConfig) {
        if (globalConfig.hasOwnProperty(key)) {
            filterConfig[key] = globalConfig[key];
        }
    }
    checkScreenSize();
    loadAndRender();
    updateSider();

    $('#toolbox').hide();
    // sugiyama(years, nodes, edges);
    addAllListeners();
    return normalizedInput;
}

// 提供给外部调用的配置更新接口
function updateNodeProb(value) {
    filterConfig.node_prob = parseFloat(value);
    loadAndRender();
}

function updateEdgeProb(value) {
    filterConfig.edge_prob = parseFloat(value);
    loadAndRender();
}

function updateSliceThreshold(value) {
    filterConfig.topic_prob = parseFloat(value);
    render();
}

function updateYearGrid(value) {
    yearGrid = parseInt(value);
    render();
}

class Graph {
    constructor() {
        this.adjList = new Map();
        this.nodeProperties = new Map();
    }

    addNode(node, properties = {}) {
        if (!this.adjList.has(node)) {
            this.adjList.set(node, []);
            this.nodeProperties.set(node, properties);
        }
    }

    addEdge(v1, v2) {
        if (!this.adjList.has(v1)) {
            this.addNode(v1);
        }
        if (!this.adjList.has(v2)) {
            this.addNode(v2);
        }
        this.adjList.get(v1).push(v2);
        this.adjList.get(v2).push(v1); // 如果是无向图，则添加此行
    }

    dfs(start) {
        const visited = new Set();
        const stack = [start];

        while (stack.length) {
            const node = stack.pop();
            if (!visited.has(node)) {
                visited.add(node);
                const neighbors = this.adjList.get(node);
                for (const neighbor of neighbors) {
                    if (!visited.has(neighbor)) {
                        stack.push(neighbor);
                    }
                }
            }
        }

        return visited;
    }

    findConnectedComponents() {
        const visited = new Set();
        const components = [];

        for (const [node] of this.adjList.entries()) {
            if (!visited.has(node)) {
                const component = this.dfs(node);
                components.push([...component]);
                component.forEach(v => visited.add(v));
            }
        }

        return components;
    }

    findLastNodeInComponent(component) {
        let maxYear = -Infinity;
        let lastNode = null;

        // 遍历连通分量中的每个节点
        component.forEach(nodeId => {
            const nodeData = this.nodeProperties.get(nodeId);
            // 检查年份，找到最大的年份
            if (nodeData.year && nodeData.year > maxYear) {
                maxYear = nodeData.year;
                lastNode = nodeId;
            }
        });

        // 确认找到的最后一个节点是否以 'l' 或 'r' 开头
        if (lastNode && !['l', 'r'].includes(lastNode[0])) {
            return lastNode;
        }

        return null;  // 如果节点以 'l' 或 'r' 开头或未找到合适的节点，返回 null
    }
}
function highlight_node(id, show_node_info=true, append=false) {   // 输入：当前node的 id
    // if (image_switch == 0)  return;
    // reset_node();
    if (show_node_info) {
        highlighted = highlighted.filter(item => !String(item).includes('->'));
        matrixg.selectAll('.epath')
            .style("stroke", d=> d.color)
            .style("stroke-width", d=>d.width)
            .style('opacity', 1);
        matrixg.selectAll('.epath-polygon')
            .style("fill", d=>d.color)
            .style('opacity', 1);
    }

    if (append) {
        if (highlighted.includes(id)) {
            highlighted = highlighted.filter(d => d != id);
        } else {
            highlighted.push(id);
        }
    } else {
        highlighted = [id];
    }
    
    ids = get_neighbor(highlighted, getActiveSliceGraph(getSelectedSliceId()));
    // console.log('highlighted:', highlighted, 'append:', append)
    ids = ids.concat(highlighted);

    // if (draw_hypertree) draw_hyper_tree(id);

    d3.selectAll('.entity-node').style('opacity', virtualOpacity).style('stroke', 'none');
    ids.forEach(id => {
        d3.selectAll(`.entity-${id}`).style('opacity', 1);
    });
    highlighted.forEach(id => {
        d3.selectAll(`.entity-${id}`).style('stroke', 'red').style('stroke-width', 5);
    });
    
    d3.selectAll('.egroup').style('opacity', virtualOpacity);
    highlighted.forEach(id => {
        egroup = d3.selectAll(`.egroup_${id}`).style('opacity', 1);
        egroup.selectAll('.epath').style('stroke', 'red');
        egroup.selectAll('.epath-polygon').style('fill', 'red');
    })
    d3.selectAll('.bar')
        .style("opacity", virtualOpacity)
    d3.selectAll(`.bar_${id}`)
        .style("opacity", 0.7)
        .style("stroke", "red")
        .style("stroke-width", 3);
    extend_ids.forEach(id => {
        d3.selectAll(`.bar_${id}`)
            .style("opacity", 0.7);
    });

    if (show_node_info) {
        showNodeInfo(id);
    }
}

function reset_node(reset_info=false) {
    // console.log('reset_node called')

    d3.selectAll('.bar')
        .style('opacity', 0.7)
        .style("stroke", "none");
        
    d3.selectAll('.egroup').style("opacity", 1);
    d3.selectAll('.entity-node').style('opacity', 1);
    d3.selectAll('.entity-node').style('stroke', 'none');

    if (matrixg) {
        matrixg.selectAll('.epath')
            .style("stroke", d=> d.color)
            .style("stroke-width", d=>d.width)
            .style('opacity', 1);
        matrixg.selectAll('.epath-polygon')
            .style("fill", d=>d.color)
            .style('opacity', 1);
    }
    
    highlighted = [];
    extend_ids = [];
    if (reset_info) {
        cancelActiveStreamSelection();
        showPaperList();
    }
}

function highlight_edge(id) {
    debugLog('highlight_edge', id)
    let id_arr = id.split('->');
    var source = id_arr[0], target = id_arr[1];
    highlighted = [id];
}

function formatDetailValue(value, fallback = "Not available") {
    if (value == null || value === "") return fallback;
    return value;
}

function selectorForIds(ids = []) {
    return ids.map(id => `#${id}`).join(", ");
}

function setTextForIds(ids = [], value) {
    const selector = selectorForIds(ids);
    if (selector) $(selector).text(value);
}

function getEntityListSelector() {
    return "#entity-list, #paper-list";
}

function findNodeById(id) {
    const nodeId = String(id);
    return getActiveEntities().find(node => String(node.id) === nodeId) ||
        (authorData?.nodes || []).find(node => String(node.id) === nodeId) ||
        null;
}

function findEdgeById(id) {
    const [source, target] = String(id).split("->");
    if (!source || !target) return null;
    return getActiveRelations().find(edge => String(edge.source) === source && String(edge.target) === target) ||
        (authorData?.edges || []).find(edge => String(edge.source) === source && String(edge.target) === target) ||
        null;
}

function resolveEdgeDetail(id) {
    const edgeId = String(id);
    const groupedEdge = graph?.combinedContextEdges?.[edgeId] || null;
    const edgeList = groupedEdge?.edges || [];
    const edge = edgeList[0] || findEdgeById(edgeId);

    if (!edge) {
        return {
            edge: null,
            edgeCount: edgeList.length,
            sourceNode: null,
            targetNode: null,
        };
    }

    return {
        edge,
        edgeCount: edgeList.length || 1,
        sourceNode: findNodeById(edge.source),
        targetNode: findNodeById(edge.target),
    };
}

function showEntityList() {
    $("#node-info, #edge-info").hide();
    $(getEntityListSelector()).show();
}

function showPaperList() {
    showEntityList();
}

function showNodeInfo(id) {
    const node = findNodeById(id);
    if (!node || $("#node-info").length === 0) return;

    $(`${getEntityListSelector()}, #edge-info`).hide();
    $("#node-info").show();

    setTextForIds(["entity-id", "paper-id"], formatDetailValue(node.id));
    setTextForIds(["entity-name", "paper-name"], formatDetailValue(node.name));
    setTextForIds(["entity-time", "paper-year"], formatDetailValue(node.year));
    setTextForIds(["entity-impact", "paper-citation"], node.citationCount === '-1' ? "Not available" : formatDetailValue(node.citationCount));
    setTextForIds(["entity-meta", "paper-authors"], formatDetailValue(node.authors));
    setTextForIds(["entity-importance", "paper-prob"], Number.isFinite(parseFloat(node.isKeyPaper)) ? parseFloat(node.isKeyPaper).toFixed(2) : "Not available");
    setTextForIds(["entity-source", "paper-venue"], formatDetailValue(node.venu));

    const topic = getTopic(node.topic);
    setTextForIds(["entity-slice", "paper-field"], formatDetailValue(topic.name ? topic.name.split(' ').join(', ') : topic.shortName));
    setTextForIds(["entity-description", "abstract"], formatDetailValue(node.abstract));
}

function showEdgeInfo(id) {
    if ($("#edge-info").length === 0) return;

    const detail = resolveEdgeDetail(id);
    const edge = detail.edge;
    if (!edge) return;

    $(`${getEntityListSelector()}, #node-info`).hide();
    $("#edge-info").show();

    const source = detail.sourceNode || {};
    const target = detail.targetNode || {};
    const relationCount = detail.edgeCount > 1 ? ` (${detail.edgeCount} grouped relations)` : "";

    setTextForIds(["relation-weight", "extend-prob"], `${Number.isFinite(parseFloat(edge.extends_prob)) ? parseFloat(edge.extends_prob).toFixed(4) : "Not available"}${relationCount}`);
    setTextForIds(["source-entity", "source-paper"], formatDetailValue(source.name || edge.source));
    setTextForIds(["source-entity-time", "source-paper-year"], formatDetailValue(source.year));
    setTextForIds(["source-entity-source", "source-paper-venu"], formatDetailValue(source.venu));
    setTextForIds(["source-entity-impact", "source-paper-citation"], source.citationCount === '-1' ? "Not available" : formatDetailValue(source.citationCount));
    setTextForIds(["target-entity", "target-paper"], formatDetailValue(target.name || edge.target));
    setTextForIds(["target-entity-time", "target-paper-year"], formatDetailValue(target.year));
    setTextForIds(["target-entity-source", "target-paper-venu"], formatDetailValue(target.venu));
    setTextForIds(["target-entity-impact", "target-paper-citation"], target.citationCount === '-1' ? "Not available" : formatDetailValue(target.citationCount));
    setTextForIds(["relation-context", "citation-context"], formatDetailValue(edge.citation_context));
}

function highlightSelectedSlice(rotate=true) {
    const activeSliceId = getSelectedSliceId();
    reset_tag();
    if (activeSliceId == null) {
        updateOpacity();
        return;
    }

    highlight_tag(activeSliceId, true);
    let ix = getActiveSlices().findIndex(d => String(d.id) === String(activeSliceId));
    if (rotate && ix >= 0) rotateTo(ix, updateOpacity);
    else updateOpacity();
}

function getSelectedSliceDetail(sliceId) {
    if (sliceId == null) {
        return {
            sliceId: null,
            slice: null,
            graph: null,
        };
    }

    const normalizedSliceId = String(sliceId);
    const slice = findActiveSlice(normalizedSliceId);
    return {
        sliceId: normalizedSliceId,
        slice,
        graph: getActiveSliceGraph(normalizedSliceId) || null,
    };
}

function emitSliceSelection(sliceId, source="prism") {
    const detail = {
        ...getSelectedSliceDetail(sliceId),
        source,
    };

    if (typeof mainPanelOptions.onSelectSlice === "function") {
        mainPanelOptions.onSelectSlice(detail.sliceId, detail);
    }

    if (typeof CustomEvent === "function") {
        const target = document.getElementById(mainPanelElementId) || document;
        target.dispatchEvent(new CustomEvent("prismviz:sliceselect", { detail }));
    }
}

function syncSliceTreeSelection(sliceId) {
    const previousSliceId = activeSyncedSliceId;
    const nextSliceId = sliceId == null ? null : String(sliceId);

    if (previousSliceId != null && previousSliceId !== nextSliceId) {
        document.querySelectorAll(`.tree-node[data-node-id="${previousSliceId}"]`)
            .forEach(node => node.classList.remove("active"));
    }

    if (nextSliceId != null) {
        document.querySelectorAll(`.tree-node[data-node-id="${nextSliceId}"]`)
            .forEach(node => node.classList.add("active"));
    }
}

const syncTreeSelection = syncSliceTreeSelection;

function syncMainSliceLabel(sliceId) {
    const previousSliceId = activeSyncedSliceId;
    const nextSliceId = sliceId == null ? null : String(sliceId);

    if (previousSliceId != null && previousSliceId !== nextSliceId) {
        const previousRect = d3.select(`#rect_${previousSliceId}`);
        if (!previousRect.empty()) {
            previousRect
                .attr("fill-opacity", 0.6)
                .style("stroke", "none")
                .style("stroke-width", "0px");
        }

        const previousText = d3.select(`#text_${previousSliceId}`);
        if (!previousText.empty()) {
            previousText
                .style("opacity", 1)
                .attr("font-weight", "normal")
                .attr("fill", "black");
        }
    }

    if (nextSliceId != null) {
        const nextRect = d3.select(`#rect_${nextSliceId}`);
        if (!nextRect.empty()) {
            nextRect
                .attr("fill-opacity", 0.9)
                .style("stroke", sliceColor(nextSliceId, 1))
                .style("stroke-width", "2px");
        }

        const nextText = d3.select(`#text_${nextSliceId}`);
        if (!nextText.empty()) {
            nextText
                .style("opacity", 1)
                .attr("font-weight", "bold")
                .attr("fill", "red");
        }
    }
}

const syncMainTopicLabel = syncMainSliceLabel;

function syncActiveSlice(sliceId) {
    const nextSliceId = sliceId == null ? null : String(sliceId);
    if (activeSyncedSliceId === nextSliceId) return;
    syncMainSliceLabel(sliceId);
    syncSliceTreeSelection(sliceId);
    activeSyncedSliceId = nextSliceId;
}

function syncPrismFaceHighlight(sliceId, forceReset = false) {
    const nextSliceId = sliceId == null ? null : String(sliceId);

    if (forceReset) {
        Object.values(prismFaceElementBySliceId).forEach(face => {
            face.attr("fill-opacity", backgroundOpacity).attr("stroke", "none");
        });
        activePrismFaceSliceId = null;
    }

    if (activePrismFaceSliceId != null && activePrismFaceSliceId !== nextSliceId) {
        const previousFace = prismFaceElementBySliceId[activePrismFaceSliceId];
        if (previousFace) {
            previousFace.attr("fill-opacity", backgroundOpacity).attr("stroke", "none");
        }
    }

    if (nextSliceId != null) {
        const nextFace = prismFaceElementBySliceId[nextSliceId];
        if (nextFace) {
            nextFace
                .attr("fill-opacity", highlightOpacity)
                .attr("stroke", sliceColor(nextSliceId, 1));
        }
    }

    activePrismFaceSliceId = nextSliceId;
}

function selectPrismSlice(sliceId, options={}) {
    const toggle = options.toggle !== false;
    const nextSliceId = sliceId == null ? null : String(sliceId);
    const shouldClear = nextSliceId == null || (toggle && getSelectedSliceId() === nextSliceId);

    const activeSliceId = setSelectedSliceId(shouldClear ? null : nextSliceId);
    syncActiveSlice(activeSliceId);

    if (activeSliceId == null) {
        reset_tag();
        updateOpacity();
        emitSliceSelection(null, options.source || "prism");
        return null;
    }

    highlightSelectedSlice(options.rotate !== false);
    emitSliceSelection(activeSliceId, options.source || "prism");
    return activeSliceId;
}

function selectSlice(sliceId, options = {}) {
    return selectPrismSlice(sliceId, options);
}

function highlight_tag(topic_id, is_click) {
    const activeSliceId = getSelectedSliceId();
    if (is_click) {
        if (activeSliceId != null) {
            d3.selectAll(".tag-text")
                .style("opacity", 0.5);
            d3.select(`#text_${topic_id}`)
                .style("opacity", 1);
        } else {
            d3.selectAll(".tag-text")
                .style("opacity", 1);
        }
    }
    d3.select(`#text_${topic_id}`)
        .attr('font-weight', 'bold')
        .attr('fill', 'red');
    if (activeSliceId !== null && activeSliceId != topic_id) {
        d3.select(`#rect_${activeSliceId}`)
            .attr("fill-opacity", 1)
        d3.select(`#text_${activeSliceId}`)
            .attr('font-weight', 'bold');
    }
}

function reset_tag() {
    // reset rect color
    // highlight_topic_forceChart(-1);
    // 将所有tag都置为初始状态
    d3.selectAll(".tag-rect")
        .attr("fill-opacity", 0.6)
    d3.selectAll(".tag-text")
        .attr('font-weight', 'normal')
        .attr('fill', 'black');
    const activeSliceId = getSelectedSliceId();
    if (activeSliceId !== null) {
        d3.select(`#rect_${activeSliceId}`)
            .attr("fill-opacity", 1)
        d3.select(`#text_${activeSliceId}`)
            .attr('font-weight', 'bold')
            .attr('fill', 'red');
    }
}

function selectorById(id) {
    if (id.indexOf('->'))
        return 'e' + id.replace('->', '_');

    return 'n' + id;
}

function calculateRadiiSteven(perceivedAreas) {
    let actualAreas = perceivedAreas.map(perceivedToActualArea);
    let totalActualArea = actualAreas.reduce((a, b) => a + b, 0);
    let maxRadius = Math.sqrt(totalActualArea / Math.PI);

    let radii = [];
    let currentArea = totalActualArea;

    for (let i = 0; i < actualAreas.length; i++) {
        let radius = Math.sqrt(currentArea / Math.PI);
        radii.push(radius);
        currentArea -= actualAreas[i];
    }

    // Normalize radii so that the outermost radius is 1
    let normalizedRadii = radii.map(r => r / maxRadius);
    return normalizedRadii;
}

function calculateRadii(weigths) {
    // 最外圈为1，按照权重直接线性缩放
    //      如(1,1,1,1)，那么半径为(1,0.75,0.5,0.25)
    //      如(1,2,3,4)，那么半径为(1, 0.9, 0.7, 0.4)

    let total = weigths.reduce((a, b) => a + b, 0);
    let current = total;
    let radii = []
    weigths.forEach(w => {
        radii.push(current / total);
        current -= w;
    })
    return radii;
}

function hsvToColor(color, sat=0.4) {
    // return d3.hsv(d.color[0], d.color[1] * 0.5 + 0.5, d.color[2]);
    return d3.hsv(color[0], sat, color[2]) //  color[1]
}

function colorToHsv(color) {
    if (color == null || color === "") return null;
    if (Array.isArray(color) && color.length >= 3) {
        return d3.hsv(Number(color[0]), Number(color[1]), Number(color[2]), color[3] == null ? 1 : Number(color[3]));
    }
    if (typeof color === "object") {
        if (color.h != null && color.s != null && color.v != null) {
            return d3.hsv(Number(color.h), Number(color.s), Number(color.v), color.opacity == null ? 1 : Number(color.opacity));
        }
        if (color.r != null && color.g != null && color.b != null) {
            return d3.hsv(d3.rgb(Number(color.r), Number(color.g), Number(color.b), color.opacity == null ? 1 : Number(color.opacity)));
        }
    }
    try {
        const parsed = d3.color(String(color));
        return parsed ? d3.hsv(parsed) : null;
    } catch (error) {
        console.warn("Invalid slice color skipped:", color, error);
        return null;
    }
}

function sliceColor(sliceId, sat=undefined) {
    // console.log('Initial slice:', sliceId);    null
    // console.log('typeof slice:', typeof sliceId);  string

    let c = d3.hsv(d3.color("#d9d9d9"));
    if (!isNull(sliceId)) {
        sliceId = String(sliceId);
        c = colorToHsv(global_colors[sliceId]) || c;
    }
    c = [c.h, c.s, c.v];
    
    return sat == undefined? hsvToColor(c): hsvToColor(c, sat);
}

function topic2color(topic, sat=undefined) {
    return sliceColor(topic, sat);
}

function createDot(graph) {
    /*
    Generates a DOT graph representation.

    Inputs:
        graph['nodes']: A list of node objects, each with 'id', 'citationCount', 'year' attributes.
        graph['edges']: A list of edge objects, each with 'source' and 'target' attributes.
        minYear: The minimum year among the graph['nodes'].
        maxYear: The maximum year among the graph['nodes'].
    */
    let size = '';
    if (graph['width']!=undefined && graph['height']!=undefined) {
        size = `size="${graph['width']},${graph['height']}"\nratio="fill"`;
    }
    const layoutMode = normalizeScrollLayoutMode(graph.layoutMode || prismVizScrollOptions.layoutMode);
    const useLayeredLayout = isLayeredScrollLayout(layoutMode);

    // ${getEdgeBundlingStr()}\n
    let dot = `digraph G {\n${size}\n`; // \nnode [shape=circle]
    let yearDic = {};

    if (useLayeredLayout) {
        for (let year = minYear; year <= maxYear; year++) {
            dot += `year${year} [label="${year}"]\n`;
            yearDic[year] = [`year${year}`]
        }
    }
    graph['nodes'].forEach(node => {
        // const label = node.name.replace(/"/g, '\\"'); // 转义名称中的双引号
        let suffix = '';
        // if (isCollapse && node.citationCount < 10) {
        //     suffix = 'shape=point';
        // } else {
        if (nodeShape == 1 || nodeShape == 2) suffix = 'shape=box';
        else if (nodeShape == 3) suffix = 'shape=hexagon';

        if (isCollapse) {
            if (node.citationCount < 50) suffix += ' fontsize=15';
            else if (node.citationCount < 100) suffix += ' fontsize=20';
            else suffix += ' fontsize=25';
        }
        if (regular) suffix += ' regular=true';

        dot += `${node.id} [label=${node.citationCount} ${suffix}]\n`;
        if (useLayeredLayout) {
            const nodeYear = Number(node.year);
            if (yearDic[nodeYear]) yearDic[nodeYear].push(node.id);
        }
    });
    if (useLayeredLayout) {
        // 对每个年份的节点使用rank=same来强制它们在同一层
        for (let year of Object.keys(yearDic))
            dot += `{ rank=same ${yearDic[year].join(' ')} }\n`;
        for (let year = minYear; year < maxYear; year++)
            dot += `year${year}->year${year+1}\n`;
    }

    graph['edges'].forEach(edge => {
        dot += `${edge.source}->${edge.target}\n`;
    });

    dot += '}';
    graph['dot'] = dot
}

function processDotContext(graph) {
    /*
    Processes a dot graph to adjust and filter graph['nodes'] and graph['edges'] based on context graph['edges'] and a yearGrid system.

    Inputs:
        dot: A string containing the dot graph.
        graph['contextEdges']: Dictionary where keys are 'lxxxx->rxxxx' edge strings and values are attributes like weight.
        yearGrid: Integer value representing the yearGrid size for adjusting years in node labels.
        graph['virtualEdges']: virtual graph['edges'] connecting the components 

    Returns:
        output: A string containing the processed dot graph with graph['nodes'] and graph['edges'] adjusted based on the context.
    */
    let l = minYear;
    let r = maxYear;
    let labels = '';
    let focusEdgesStr = '';
    ranks = '';

    // 解析 .dot 输入以分类行并更新年份
    graph['dot'].split('\n').forEach(line => {
        if (line.includes('year')) {
            if (line.includes('rank')) {
                ranks += line + '\n';
            }
        } else if (line.includes('label')) {
            labels += '\t' + line + '\n';
        } else if (line.includes('->')) {
            focusEdgesStr += '\t' + line + '\n';
        }
    });

    // 替换年份标签
    let newRanks = [];
    ranks.split('\n').forEach(line => {
        let match = /year(\d+)/.exec(line);
        if (match && parseInt(match[1], 10) >=l && parseInt(match[1], 10) <= r) {
            newRanks.push(line.replace(/year(\d+)/, (match, p1) => `l${p1} r${p1}`));
        }
    });
    ranks = newRanks.join('\n');

    // 生成左右节点的链
    let leftNodes = Array.from({ length: r - l + 1 }, (_, i) => `l${l + i}`).join('->');
    let rightNodes = Array.from({ length: r - l + 1 }, (_, i) => `r${l + i}`).join('->');

    // 处理并合并contextEdges，可能把多年合并到一年
    graph['combinedContextEdges'] = {};
    Object.entries(graph['contextEdges']).forEach(([edge, edgeList]) => {
        let weight = edgeList.length;
        let newEdge = transfromEdgeName(edge);
        graph['combinedContextEdges'][newEdge] = graph['combinedContextEdges'][newEdge] || 
            { topics:{}, name: newEdge, edges: [], weight: 0, penwidth: 0, port: newEdge[0] === 'l' ? 'tailport=e' : 'headport=w' };
        
        graph['combinedContextEdges'][newEdge].weight += weight;
        graph['combinedContextEdges'][newEdge].penwidth += weight;  // 假设 penwidth 是累积的
        for (let edge of edgeList) {
            graph['combinedContextEdges'][newEdge].edges.push(edge);
            const entitySliceMap = getActiveEntitySliceMap();
            let topic = newEdge[0] == 'l'? entitySliceMap[edge.source]: entitySliceMap[edge.target];
            graph['combinedContextEdges'][newEdge].topics[topic] = (graph['combinedContextEdges'][newEdge].topics[topic] || 0) + 1;
        }
    });

    // 生成上下文边字符串
    let contextEdgesStr = Object.entries(graph['combinedContextEdges']).map(([edge, data]) =>
        `${edge} [color="lightgray", ${data.port}, weight=${data.weight}, penwidth=${data.penwidth}]`
    ).join('\n');
    let virtualEdgesStr = graph['virtualEdges'] ? graph['virtualEdges'].map(edge => `${edge} [style="invis"]`).join('\n') : '';

    let size = '';
    if (graph['width']!=undefined && graph['height']!=undefined) {
        size = `size="${graph['width']},${graph['height']}"\nratio="fill"`;
        debugLog('size', size);
    }

    // 生成最终输出 DOT 字符串 node [shape=circle]
    graph['dotContext'] = `digraph G {
${size}
crossing_type=1
${getEdgeBundlingStr()}

subgraph left {
    style=filled
    color=lightgrey
    node [style=filled,color=lightblue]
${leftNodes} [weight=10000]
    label = "left"
}

subgraph focus{
    edge [weight=${alpha}]
${labels}
${focusEdgesStr}
}

subgraph right {
    style=filled
    color=lightgrey
    node [style=filled,color=lightgrey]
${rightNodes} [weight=10000]
    label = "right"
}

${ranks}
${contextEdgesStr}
l${l}->r${l} [style="invis"]
${virtualEdgesStr}
}`;
}

function parseSVG(graph) {
    graph['id2attr'] = {};
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    // 解析节点
    graph['svgElement'].querySelectorAll('g.node').forEach(node => {
        const title = node.querySelector('title').textContent;
        const shape = node.querySelector('ellipse, polygon, rect'); // 支持椭圆或多边形
        const text = node.querySelector('text');

        let cx, cy, rx, ry;

        if (shape.tagName === 'ellipse') {
            cx = parseFloat(shape.getAttribute('cx'));
            cy = parseFloat(shape.getAttribute('cy'));
            rx = parseFloat(shape.getAttribute('rx'));
            ry = parseFloat(shape.getAttribute('ry'));
        } else if (shape.tagName === 'rect') {
            const x = parseFloat(shape.getAttribute('x'));
            const y = parseFloat(shape.getAttribute('y'));
            const width = parseFloat(shape.getAttribute('width'));
            const height = parseFloat(shape.getAttribute('height'));

            cx = x + width / 2;
            cy = y + height / 2;
            rx = width / 2;
            ry = height / 2;
        } else if (shape.tagName === 'polygon') {
            // 根据多边形的具体形状解析
            const points = shape.getAttribute('points').split(' ').map(point => point.split(',').map(Number));
            const xs = points.map(point => point[0]);
            const ys = points.map(point => point[1]);
            cx = (Math.min(...xs) + Math.max(...xs)) / 2;
            cy = (Math.min(...ys) + Math.max(...ys)) / 2;
            rx = (Math.max(...xs) - Math.min(...xs)) / 2;
            ry = (Math.max(...ys) - Math.min(...ys)) / 2;
        }

        minX = Math.min(minX, cx - rx);
        maxX = Math.max(maxX, cx + rx);
        minY = Math.min(minY, cy - ry);
        maxY = Math.max(maxY, cy + ry);
        
        graph['id2attr'][title] = {
            id: title,
            fill: shape.getAttribute('fill'),
            stroke: shape.getAttribute('stroke'),
            x: cx,
            y: cy,
            rx: rx,
            ry: ry,
            label: text ? text.textContent : ''
        };
    });

    // 解析边
    graph['svgElement'].querySelectorAll('g.edge').forEach(edge => {
        // dismiss port
        const title = edge.querySelector('title').textContent.replace(/:w|:e/g, '');;
        const paths = edge.querySelectorAll('path');
        const polygon = edge.querySelector('polygon');

        let edgePaths = Array.from(paths).map(path => ({
            fill: path.getAttribute('fill'),
            stroke: path.getAttribute('stroke'),
            d: path.getAttribute('d'),
            s: getEndPoint(path.getAttribute('d'), 's'),
            t: getEndPoint(path.getAttribute('d'), 't')
        })).sort((a, b) => {
            const distanceA = Math.sqrt(Math.pow(a.t.x - b.s.x, 2) + Math.pow(a.t.y - b.s.y, 2));
            const distanceB = Math.sqrt(Math.pow(b.t.x - a.s.x, 2) + Math.pow(b.t.y - a.s.y, 2));
            return distanceA - distanceB; // 排序，使得路径首位相连
        });

        graph['id2attr'][title] = {
            id: title,
            name: title,
            path: edgePaths,
            polygon: polygon ? {
                fill: polygon.getAttribute('fill'),
                stroke: polygon.getAttribute('stroke'),
                points: polygon.getAttribute('points')
            } : null
        };
    });
    // graph['viewBox'] = graph['svgElement'].getAttribute('viewBox');
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    // graph['transform'] = graph['svgElement'].getAttribute('transform');

    graph['viewBox'] = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    graph['transform'] = `translate(0,${maxY - minY})`;

    graph['nodes'].forEach(node => {
        Object.assign(node, graph['id2attr'][node.id]);
    });
    graph['edges'].forEach(edge => {
        let edgeKey = edge.source + '->' + edge.target;
        Object.assign(edge, graph['id2attr'][edgeKey]);  // 合并边的属性
    });
}

// 获取路径的起点或终点
function getEndPoint(d, type) {
    let points = d.match(/([0-9.-]+),([0-9.-]+)/g);
    if (!points) return { x: 0, y: 0 };
    points = points.map(pt => {
        const coords = pt.split(',');
        return { x: parseFloat(coords[0]), y: parseFloat(coords[1]) };
    });
    return type === 's' ? points[0] : points[points.length - 1];
}

function probToOpacity(prob, a=0.2) {
    // 将透明度从[0.3, 0.8]映射到 [a, 1] 范围
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    return a + (maxOpacity - a) * opacity;
}

function probToWidth(prob, a=1, b=4) {
    const opacity = Math.min(Math.max((prob - 0.3) / (0.8 - 0.3), 0), 1);
    let ret = a + opacity * (b - a);
    return ret;
}

function init_graph(graph, context=true) {
    syncScrollGraphAliases(graph);
    graph['contextEdges'] = graph['contextEdges'] || {};
    graph['combinedContextEdges'] = graph['combinedContextEdges'] || {};
    if (graph['sliceId'] == null) context = false;
    else if (context) {
        Object.keys(graph['contextEdges']).forEach(name => {
            let edges = graph['contextEdges'][name];
            if (name[0] == 'l') {
                let nodeId = name.split('->')[1];
                let node = graph['nodes'].find(node => node.id == nodeId);
                const entitySliceMap = getActiveEntitySliceMap();
                let topics = edges.map(edge => entitySliceMap[edge.source]); // context节点的话题
                topics.forEach(topic => {
                    if (node.topicDist[topic]) node.influx = topic;
                })
            } else {
                let nodeId = name.split('->')[0];
                let node = graph['nodes'].find(node => node.id == nodeId);
                const entitySliceMap = getActiveEntitySliceMap();
                let topics = edges.map(edge => entitySliceMap[edge.target]); // context节点的话题
                topics.forEach(topic => {
                    if (node.topicDist[topic]) node.efflux = topic;
                })
            }
        })
    }

    createDot(graph);
    if (graph['sliceId'] !== null && context) {
        // subgraph + context
        processDotContext(graph);
        graph['svgElement'] = vizContext.renderSVGElement(graph['dotContext']);
    } else {
        graph['svgElement'] = viz.renderSVGElement(graph['dot']);
    }
    
    parseSVG(graph);
    // console.log(graph['svgElement'], graph);

    // 创建一个无主的SVG元素
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    svgElement.setAttribute('viewBox', graph['viewBox']);
    // svgElement.setAttribute('transform', graph['transform']);

    let svg = d3.select(svgElement);
    matrixg = svg.append('g');
    graph['g'] = matrixg;

    if (context) drawContextEdges(graph);

    // 绘制每条边的所有路径
    // 为每条边创建一个独立的group元素
    const edgeGroups = matrixg.selectAll('.egroup')
        .data(graph['edges']) // 使用edges数组，每个元素代表一条边
        .enter()
        .append('g')
        .attr('class', d => {
            const entitySliceMap = getActiveEntitySliceMap();
            return `egroup egroup_${d.source} egroup_${d.target} 
            egroup_${entitySliceMap[d.source]} egroup_${entitySliceMap[d.target]}`;
        });

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        const edgeGroup = d3.select(this);

        if (edge.path == undefined) {
            debugLog('edge path undefined', edge);
            return true;
        }
        // console.log('draw edge', edge, probToOpacity(edge.extends_prob), probToWidth(edge.extends_prob))
        edgeGroup.selectAll('.epath')
            .data(edge.path) // 绑定每条边的路径数组
            .enter()
            .append('path')
            .attr('d', d=>{
                d.width = probToWidth(edge.extends_prob);
                d.color = 'black';
                return d.d
            })
            .style("fill", 'none')
            .style("stroke", 'black')
            .style('stroke-opacity', probToOpacity(edge.extends_prob))
            .style('stroke-width', probToWidth(edge.extends_prob))
            .attr('class', 'epath')
            .attr('id', selectorById(edge.name))
            .on('mouseover', function () {
                mouseoverEdge(edge.name);
                tip.show({name: edge.name});
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide({name: edge.name});
            });
            
        if (!edge.polygon) {
            return true;
        }
        edgeGroup.append('polygon')
            .attr('points', edge.polygon.points)
            .style('stroke', 'none')
            .style('fill', d=>{
                d.color = 'black';
                return 'black'
            })
            .style("fill-opacity", probToOpacity(edge.extends_prob))
            .attr('class', 'epath-polygon')
            .attr('id', selectorById(edge.name) + '_polygon')
            .on('mouseover', function () {
                mouseoverEdge(edge.name);
                tip.show(edge);
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide(edge);
            });
    });

    let circle;
    let enlarge_ratio = {0: 1, 1: 1.5, 2: 2}[enlarge % 3]
    if (nodeShape == 0)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                let topics, radii;
                if (graph['sliceId'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['sliceId'], d.efflux].filter(t => t !== undefined);
                    radii = calculateRadii(topics.map(t => d.topicDist[t]));
                }
                // 从外向内绘制同心圆
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('ellipse')
                        .attr('cx', d.x)
                        .attr('cy', d.y)
                        .attr('rx', d.rx * radii[i] * enlarge_ratio)
                        .attr('ry', d.ry * radii[i] * enlarge_ratio)
                        .style("fill", sliceColor(topics[i]));
                }
            });
    if(nodeShape == 1)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                let topics, radii;
                if (graph['sliceId'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['sliceId'], d.efflux].filter(t => t !== undefined);
                    radii = calculateRadii(topics.map(t => d.topicDist[t]));
                }
                // 从外向内绘制同心矩形
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('rect')
                        .attr('x', d.x - d.rx * radii[i] * enlarge_ratio)
                        .attr('y', d.y - d.ry * radii[i] * enlarge_ratio)
                        .attr('width', d.rx * 2 * radii[i] * enlarge_ratio)
                        .attr('height', d.ry * 2 * radii[i] * enlarge_ratio)
                        .style("fill", sliceColor(topics[i]));
                }
            });

    if (nodeShape == 2) 
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .attr('transform', d => {
                let w = d.rx * 3;
                let h = d.ry * 5;
                return `translate(${d.x - w / 2}, ${d.y - h * 0.4}) scale(${w / bookWidth}, ${h / bookHeight})`;
            })
            .each(function(d) {
                bookPaths.forEach(path => {
                    d3.select(this).append('path')
                        .attr('d', path)
                        .style('fill-opacity', 0.4)
                        .style('fill', updateOutlineColor(d.isKeyPaper, d.citationCount));
                });
            })
    if (nodeShape == 3)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                let topics, radii;
                if (graph['sliceId'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['sliceId'], d.efflux].filter(t => t !== undefined);
                    radii = calculateRadii(topics.map(t => d.topicDist[t]));
                }
                // 从外向内绘制同心多边形
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('polygon')
                        .attr('points', function(d) {
                            const rx = d.rx * radii[i] * enlarge_ratio;
                            const ry = d.ry * radii[i] * enlarge_ratio;
                            const x = d.x;
                            const y = d.y;
                            return [
                                [x + rx, y].join(','),
                                [x + rx / 2, y + ry].join(','),
                                [x - rx / 2, y + ry].join(','),
                                [x - rx, y].join(','),
                                [x - rx / 2, y - ry].join(','),
                                [x + rx / 2, y - ry].join(',')
                            ].join(' ');
                        })
                        .style("fill", sliceColor(topics[i]));
                }
            });

    
    if (!isCollapse && (nodeShape == 0 || nodeShape == 1 || nodeShape == 3))
        circle.style("stroke", d => updateOutlineColor(d.isKeyPaper, d.citationCount))
            .style('stroke-width', d => d.citationCount >= 50? 5: 0);
    
    circle
        .attr('id', d => d.id)
        .attr('class', d => {
            let c = `entity-node entity-${d.id}`;
            getActiveSlices().forEach(field => {
                if (hasSlice(d, field.id)) {
                    c += ` entity-slice-${field.id}`;
                }
            })
            return c;
        }).on('mouseover', function (d) {
            d3.select(this).attr('cursor', 'pointer');
            tip.show(d);
            if (!highlighted.includes(d.id)) {
                d3.selectAll(`.entity-${d.id}`).style('stroke', 'red').style('stroke-width', 5);
                
                let streamPairs = [];
                Object.entries(graph['combinedContextEdges']).forEach(([edgeId, value]) => {
                    if (edgeId.indexOf(d.id) !== -1) {
                        mouseoverEdge(edgeId, width=null);
                        let dir = edgeId[0] == 'l'? 'l': 'r';
                        Object.keys(value['topics']).forEach(sliceId => {
                            streamPairs.push([dir, sliceId]);
                        });
                    }
                });
                debugLog('streamPairs', streamPairs);
                mouseOverStreamSegments(streamPairs);
            }
        })
        .on('click', function (d) {
            debugLog('click node', d.id);
            highlight_node(d.id, true, true);
        })
        .on('mouseout', function (d) {
            tip.hide(d);
            if (!highlighted.includes(d.id)) {
                d3.selectAll(`.entity-${d.id}`).style('stroke-width', 0);
                Object.keys(graph['combinedContextEdges']).forEach(edgeId => {
                    if (edgeId.indexOf(d.id) !== -1) {
                        mouseoutEdge(edgeId);
                    }
                });
                mouseleaveStreamSegment();
            }
        });

    node2size = function(d) {
        if (!isCollapse) return 30;
        let ret = d.citationCount < 50? 30: (d.citationCount < 100? 40: 50);
        // return ret;
        return Math.sqrt(ret) * 7;
    }
    matrixg.selectAll('.text1')
        .data(graph['nodes'])
        .enter().append('text')
        .attr('x', d => d.x)
        .attr('y', d => d.y + node2size(d) / 3)
        .attr('text-anchor', 'middle')
        .attr('font-family', 'Archivo Narrow')
        .attr('font-size', d => node2size(d))
        .attr('class', 'text1')
        .attr("pointer-events", "none")
        .text(d => String(d.citationCount));
        // !isCollapse || d.citationCount>=10? String(d.citationCount): ''
        
        // .each(function(d) {
        //     // let text = d.text === undefined? d.text1 + '\n' + d.text2 : String(d.citationCount)
        //     let text = d.label;
        //     var lines = text.split('\n');
        //     for (var i = 0; i < lines.length; i++) {
        //         d3.select(this).append('tspan')
        //             .attr('x', d.x)
        //             .attr('dy', 10)  // Adjust dy for subsequent lines
        //             .text(lines[i]);
        //     }
        // });
    
    

    graph['svg'] = svgElement;
    const scrollOptions = graph.scroll || graph;
    if (graph['sliceId'] == null && shouldRenderScrollContext(scrollOptions) && scrollOptions.showStreams !== false) {
        // 添加背景坐标轴
        let bbox = {};
        bbox.x = parseFloat(graph['viewBox'].split(' ')[0]);
        bbox.width = parseFloat(graph['viewBox'].split(' ')[2]);
        id2attr = graph['id2attr'];

        let prefix = 'year';
        let maxY = id2attr[prefix + maxYear].y;
        for (let year = maxYear + 1; year < maxYear + yearGrid; year++) {
            maxY += id2attr[prefix + maxYear].y - id2attr[prefix + (maxYear-1)].y;
            id2attr[prefix + year] = {"y": maxY};
        }
        var y = d3.scaleOrdinal()
            .domain(d3.range(minYear, maxYear + yearGrid))
            .range(d3.range(minYear, maxYear + yearGrid).map(year => id2attr[prefix + year].y));
        
        // minYear, maxYear
        var years = d3.range(minYear, maxYear + 1);
        var tickValues = years.filter(year => year % yearGrid === 0);
        let streamSize = bbox.width / 3;

        Tooltip = matrixg
            .append("text")
            .attr("x", bbox.x + bbox.width + 80)
            .attr("y",  y(minYear))
            .attr('font-family', 'Archivo Narrow')
            .style("opacity", 0)
            .style("font-size", 48)
        matrixg.append("g")
            .call(d3.axisLeft(y).tickSize(- bbox.width - streamSize).tickValues(tickValues))
            .select(".domain").remove();
        matrixg.selectAll(".tick line")
            .attr("stroke", "#b8b8b8")
        matrixg.selectAll(".tick text")
            .attr("x", bbox.x + bbox.width + 60)
            .attr("dy", 10)
            .attr('font-family', 'Archivo Narrow')
            .style("font-size", 48)

        let context = {};
        graph['nodes'].forEach(d=>{
            if (context[d.topic] == undefined) {
                context[d.topic] = {"total": 0};
                for (let year of years) context[d.topic][year] = [];
            }
            context[d.topic][d.year].push(d);
            context[d.topic]["total"] += 1;
        graph['context'] = context;
        })
        drawStreamgraph(matrixg, context, y, [bbox.x + bbox.width + 80, bbox.x + bbox.width + streamSize], 'm');
    }
}


function countKeywords(text, keywords) {
    // 初始化一个对象来存储关键词的计数
    const keywordCount = {};
    
    // 将所有关键词初始化为0
    keywords.forEach(keyword => {
        keywordCount[keyword] = 0;
    });

    // 将输入的文本转换为小写并分割为单词数组
    const words = text.toLowerCase().split(/\W+/);

    // 遍历单词数组，统计每个关键词的出现次数
    words.forEach(word => {
        if (keywordCount.hasOwnProperty(word)) {
            keywordCount[word]++;
        }
    });

    return keywordCount;
}

function calculateTFIDF(text, keywords, allDocuments) {
    // 初始化一个对象来存储关键词的TF-IDF值
    const tfidfValues = {};
    
    // 初始化一个对象来存储关键词的计数
    const keywordCount = {};
    keywords.forEach(keyword => {
        keywordCount[keyword] = 0;
    });

    // 将输入的文本转换为小写并分割为单词数组
    const words = text.toLowerCase().split(/\W+/);
    const totalWords = words.length;

    // 计算TF（词频）
    words.forEach(word => {
        if (keywordCount.hasOwnProperty(word)) {
            keywordCount[word]++;
        }
    });

    const tfValues = {};
    keywords.forEach(keyword => {
        tfValues[keyword] = keywordCount[keyword] / totalWords;
    });

    // 计算每个文档中包含的关键词集合，用于计算IDF
    const docContainsKeyword = {};
    keywords.forEach(keyword => {
        docContainsKeyword[keyword] = 0;
    });

    allDocuments.forEach(doc => {
        // type doc is Set?
        if (typeof doc === 'string') doc = new Set(doc.toLowerCase().split(/\W+/));
        keywords.forEach(keyword => {
            if (doc.has(keyword)) {
                docContainsKeyword[keyword]++;
            }
        });
    });

    // 计算IDF（逆文档频率）
    const documentCount = allDocuments.length;
    const idfValues = {};
    keywords.forEach(keyword => {
        idfValues[keyword] = Math.log(documentCount / (docContainsKeyword[keyword] + 1));
    });

    // 计算TF-IDF
    keywords.forEach(keyword => {
        tfidfValues[keyword] = tfValues[keyword] * idfValues[keyword];
    });

    return tfidfValues;
}

function isNull(value) {
    return value == undefined || value == null || value == 'null' || value == '' || value == NaN;
}

function sortTopicsBy(topics, keywordCount) {
    // 将话题字符串分割为单词数组
    const topicArray = topics.split(' ');
    
    // 根据关键词计数进行排序
    topicArray.sort((a, b) => {
        const countA = keywordCount[a] || 0;
        const countB = keywordCount[b] || 0;
        return countB - countA; // 降序排列
    });

    // 将排序后的数组重新拼接成字符串
    return topicArray.join(' ');
}

function generateTTM() {
    TTM = {};
    TTMEdges = {};
    const activeEntities = getActiveEntities();
    const activeRelations = getActiveRelations();
    const entityById = new Map(activeEntities.map(node => [String(node.id), node]));
    // 填充矩阵（因为是外部转移矩阵，不计相同话题的转移）
    // 注意，存在部分话题只有转入，没有转出，所以不再keys里面
    // 注意TTM相同的node只取一个，不是m*n，而是m+n

    function addEdge(src, tgt) {
        if (src == tgt) return;
        if(!TTM[src]) TTM[src] = {};
        if(!TTM[src][tgt]) TTM[src][tgt] = 0;
        TTM[src][tgt]++;
    }

    activeRelations.forEach(edge => {
        let sourceNode = entityById.get(String(edge.source));
        let targetNode = entityById.get(String(edge.target));
        if (!sourceNode || !targetNode) return;
        let sourceTopicList = getTopicList(sourceNode);
        let targetTopicList = getTopicList(targetNode);
        // 去除相同元素，不能相继filter
        let sourceTopicListCopy = [...sourceTopicList];
        sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));
        
        sourceTopicList.forEach(src => {
            addEdge(src, targetNode.topic);
        })
        targetTopicList.forEach(tgt => {
            addEdge(sourceNode.topic, tgt);
        })
    });
}

function getAllTopics(matrix) {
    let topics = new Set();
    for (let src in matrix) {
        for (let tgt in matrix[src]) {
            topics.add(src);
            topics.add(tgt);
        }
    }
    let arr = Array.from(topics);
    arr.sort((a, b) => a - b);
    return arr;
}
    
// 计算解决方案的成本
function calculateCost(matrix, solution) {
    let cost = 0;
    solution.forEach((topic, i) => {
        solution.forEach((innerTopic, j) => {
            const distance = Math.abs(i - j);
            if (matrix[topic] && matrix[topic][innerTopic])
                cost += matrix[topic][innerTopic] * distance; // 假设成本与距离成正比
        });
    });
    return cost;
}

// 接受概率
function acceptanceProbability(currentCost, newCost, temperature) {
    if (newCost < currentCost) {
        return 1.0;
    }
    return Math.exp((currentCost - newCost) / temperature);
}
function syncScrollGraphAliases(graph) {
    if (!graph) return graph;
    graph.sliceId = graph.sliceId ?? null;
    graph.entities = graph.entities || graph.nodes || [];
    graph.nodes = graph.nodes || graph.entities || [];
    graph.relations = graph.relations || graph.edges || [];
    graph.edges = graph.edges || graph.relations || [];
    graph.sliceField = graph.sliceField || graph.paper_field || [];
    graph.paper_field = graph.paper_field || graph.sliceField || [];
    graph.slices = graph.slices || graph.sliceField || graph.paper_field || [];
    return graph;
}

function loadSliceGraph(sliceId, options = {}) {
    const activeEntities = getActiveEntities();
    const activeRelations = getActiveRelations();
    const entityById = new Map(activeEntities.map(node => [String(node.id), node]));
    const scrollOptions = getPrismVizScrollOptions(options);
    const supportsLayeredContext = isLayeredScrollLayout(scrollOptions.layoutMode);
    // activeEntities.map(d=>Object.keys(d.topicDist).length)
    // new Set(activeEntities.map(d=>d.topic)) // 有多少个topic
    // 1. 将所有topicDist = {}的节点设置为最后一个topic
    // 2. 将所有topic总数小的节点设置为最后一个topic
    graph = {}
    graph['sliceId'] = sliceId;
    graph['layoutMode'] = scrollOptions.layoutMode;
    graph['scrollRenderer'] = scrollOptions.scrollRenderer;
    graph['scroll'] = scrollOptions;
    graph['nodes'] = JSON.parse(JSON.stringify(activeEntities));
    graph['edges'] = JSON.parse(JSON.stringify(activeRelations));

    if (sliceId !== null) {
        graph['nodes'] = graph['nodes'].filter(d => hasSlice(d, sliceId));
            // getActiveSlices().find(d => d.id == sliceId).size = graph['nodes'].length;
        // if (graph['nodes'].length == 0) {
        //     console.log('No node found in the selected topic', sliceId);
        //     return;
        // }

        let nodeSet = new Set(graph['nodes'].map(node => node.id));
        graph['edges'] = graph['edges'].filter(edge => nodeSet.has(edge.source) && nodeSet.has(edge.target));
        let edgeStrs = graph['edges'].map(edge => edge.source + '->' + edge.target); 

        graph['contextEdges'] = {};
        graph['virtualEdges'] = [];
        if (supportsLayeredContext) {
            let G = new Graph();
            graph['nodes'].forEach(node => {
                G.addNode(node.id, node);
            });
            graph['edges'].forEach(edge => {
                G.addEdge(edge.source, edge.target);
            });
            for (let year = minYear; year <= maxYear; year++) {
                G.addNode(`l${year}`, {year: year});
                G.addNode(`r${year}`, {year: year});
            }
            for (let year = minYear; year < maxYear; year++) {
                G.addEdge(`l${year}`, `l${year+1}`);
                G.addEdge(`r${year}`, `r${year+1}`);
            }

            // 处理上下文边
            activeRelations.forEach(edge => {
                if (!edgeStrs.includes(`${edge.source}->${edge.target}`)) {
                    let sourceNode = entityById.get(String(edge.source));
                    let targetNode = entityById.get(String(edge.target));
                    if (!sourceNode || !targetNode) return;
                    if (!Number.isFinite(Number(sourceNode.year)) || !Number.isFinite(Number(targetNode.year))) return;

                    if (hasSlice(sourceNode, sliceId)) {
                        let key = `${sourceNode.id}->r${targetNode.year}`;
                        if (!graph['contextEdges'][key]) graph['contextEdges'][key] = [];
                        graph['contextEdges'][key].push(edge);
                        G.addEdge(sourceNode.id, `r${targetNode.year}`);
                    }
                    if (hasSlice(targetNode, sliceId)) {
                        let key = `l${sourceNode.year}->${targetNode.id}`;
                        if (!graph['contextEdges'][key]) graph['contextEdges'][key] = [];
                        graph['contextEdges'][key].push(edge);
                        G.addEdge(`l${sourceNode.year}`, targetNode.id);
                    }
                }
            });

            let components = G.findConnectedComponents();
            components.forEach(component => {
                let node = G.findLastNodeInComponent(component);
                if (node) {
                    // console.log('findLastNodeInComponent', G.nodeProperties.get(node));
                    let nodeYear = G.nodeProperties.get(node).year;
                    graph['virtualEdges'].push(`${node}->r${nodeYear}`);
                }
            });
        }
    }
    
    graph['paper_field'] = [];    //该学者个人的field信息
    graph['nodes'].forEach(node => {
        let topic = node.topic;
        if (isNull(topic)) return true;
        let ix = graph['paper_field'].findIndex(d => d.id == topic);
        if (ix == -1) {
            // 如果没有统计，在paper_field中新建k-v
            // console.log(topic)
            graph['paper_field'].push({
                id: topic,
                num: 1,
                name: globalFields[topic],
            });
        } else {
            graph['paper_field'][ix].num += 1;
        }
    })

    syncScrollGraphAliases(graph);
    setActiveSliceGraph(sliceId, graph);
}

const loadTopicGraph = loadSliceGraph;
function hasSliceWithThreshold(node, sliceId, threshold = filterConfig['topic_prob']) {
    if (node == undefined) {
        debugLog('hasSlice: node', node, 'sliceId', sliceId);
        return false;
    }

    const primarySliceId = node.primarySliceId ?? node.topic;
    const sliceWeights = node.sliceWeights || node.topicDist || {};
    if (!isNull(primarySliceId) && String(primarySliceId) === String(sliceId)) return true;
    if (sliceWeights && Number(sliceWeights[sliceId] || 0) >= threshold) return true;
    return false;
}

function hasSlice(node, sliceId) {
    return hasSliceWithThreshold(node, sliceId, filterConfig['topic_prob']);
}

const hasTopicWithThreshold = hasSliceWithThreshold;
const hasTopic = hasSlice;

function getFallbackTopicId(fields = {}) {
    const keys = Object.keys(fields || {});
    if (keys.length === 0) return null;

    const sortedKeys = [...keys].sort((a, b) => Number(a) - Number(b));
    return sortedKeys[sortedKeys.length - 1];
}

function getTopicColorPalette() {
    return [
        "#fdb462", // Orange
        "#b3de69", // Light Green
        "#fccde5", // Pink
        "#8dd3c7", // Teal
        "#ffffb3", // Yellow
        "#bebada", // Lavender
        "#fb8072", // Coral
        "#80b1d3", // Sky Blue
        "#bc80bd", // Purple
        "#ccebc5", // Light Teal
        "#a6cee3", // Light Blue
        "#33a02c", // Dark Green
        "#e31a1c", // Red
        "#fdbf6f", // Peach
        "#8c510a", // Dark Brown
        "#d73027", // Bright Red
    ].map(d => d3.hsv(d3.color(d)));
}

function getPanelFilterOptions(options = {}) {
    return {
        modeValue: String(options.modeValue ?? document.getElementById('mode')?.value ?? '0'),
        surveyValue: String(options.surveyValue ?? document.getElementById('remove-survey')?.value ?? '1'),
    };
}

function buildTopicListForNode(node, threshold) {
    if (node && node.hasOwnProperty('topicDist')) {
        let topicList = [];
        for (let key in node.topicDist) {
            if (Number(node.topicDist[key] || 0) >= threshold) topicList.push(String(key));
        }
        if (!isNull(node.topic) && !topicList.includes(String(node.topic))) {
            topicList.push(String(node.topic));
        }
        return topicList;
    }
    return node && !isNull(node.topic) ? [String(node.topic)] : [];
}

function buildTopicTransitionMatrix(nodes, edges, threshold) {
    const ttm = {};
    const nodeById = new Map(nodes.map(node => [String(node.id), node]));

    function addEdge(src, tgt) {
        if (isNull(src) || isNull(tgt) || String(src) === String(tgt)) return;
        if (!ttm[src]) ttm[src] = {};
        if (!ttm[src][tgt]) ttm[src][tgt] = 0;
        ttm[src][tgt]++;
    }

    edges.forEach(edge => {
        const sourceNode = nodeById.get(String(edge.source));
        const targetNode = nodeById.get(String(edge.target));
        if (!sourceNode || !targetNode) return;

        let sourceTopicList = buildTopicListForNode(sourceNode, threshold);
        let targetTopicList = buildTopicListForNode(targetNode, threshold);
        const sourceTopicListCopy = [...sourceTopicList];
        sourceTopicList = sourceTopicList.filter(topic => !targetTopicList.includes(topic));
        targetTopicList = targetTopicList.filter(topic => !sourceTopicListCopy.includes(topic));

        sourceTopicList.forEach(src => addEdge(src, targetNode.topic));
        targetTopicList.forEach(tgt => addEdge(sourceNode.topic, tgt));
    });

    return ttm;
}

function buildAdjacentMatrixFromTTM(paperField, ttm, arrangement = null) {
    const topicArrangement = arrangement || paperField.map(d => d.id);
    return topicArrangement.map(src =>
        topicArrangement.map(tgt => ttm[src] && ttm[src][tgt] ? ttm[src][tgt] : 0)
    );
}

function buildPaperFieldModel(nodes, fields, fieldMeta, threshold) {
    const paperFieldMap = {};
    Object.keys(fields || {}).forEach(topicId => {
        const meta = fieldMeta[String(topicId)] || {};
        paperFieldMap[topicId] = {
            id: String(topicId),
            num: 0,
            size: 0,
            name: fields[topicId],
            shortName: fields[topicId],
            chordName: meta.chordName || fallbackChordLabel(fields[topicId]),
            fullName: meta.fullName || fields[topicId],
            color: meta.color,
        };
    });

    nodes.forEach(node => {
        const topic = String(node.topic || 0);
        const topicDist = Object.keys(node.topicDist || {});

        if (!paperFieldMap[topic]) {
            paperFieldMap[topic] = {
                id: topic,
                num: 0,
                size: 0,
                name: fields[topic] || topic,
                shortName: fields[topic] || topic,
                chordName: fallbackChordLabel(fields[topic] || topic),
                fullName: fields[topic] || topic,
                color: fieldMeta[String(topic)]?.color,
            };
        }

        paperFieldMap[topic].num += 1;
        topicDist.forEach(field => {
            if (paperFieldMap[field] && hasSliceWithThreshold(node, field, threshold)) {
                paperFieldMap[field].size += 1;
            }
        });
    });

    let paperField = Object.values(paperFieldMap).sort(op('size'));
    const minSize = Math.max(5, (paperField[10] || {size: 0}).size);
    paperField = paperField.filter(item => item.size >= minSize);

    return {
        paperField,
        minSize,
    };
}

function assignTopicColors(paperField, colorMap = global_colors, fieldMeta = globalFieldMeta) {
    const palette = getTopicColorPalette();
    const nextColorMap = {...(colorMap || {})};

    paperField.forEach(topic => {
        const id = String(topic.id);
        const presetColor = colorToHsv(topic.color)
            || colorToHsv(fieldMeta?.[id]?.color)
            || colorToHsv(nextColorMap[id]);

        if (presetColor) {
            nextColorMap[id] = presetColor;
        } else {
            const ix = Object.entries(nextColorMap).length % palette.length;
            nextColorMap[id] = palette[ix];
        }
        topic.color = nextColorMap[id];
    });

    return nextColorMap;
}

function snapshotPrismVizModelState() {
    return {
        global_nodes,
        global_edges,
        global_paper_field,
        global_entities,
        global_relations,
        global_slices,
        selectedSliceId,
        focusedSliceIndex,
        viewMode,
        minYear,
        maxYear,
        TTM,
        adjacentMatrix,
        sliceRelationMatrix,
        paperID2topic,
        paperID2year,
        entityIdToSliceId,
        entityIdToTime,
        global_colors,
        global_keywords,
        topic2graph,
        sliceGraphs,
        sliceGraphsById: sliceGraphs,
        prismVizScrollOptions,
        prismRadius,
        prismScale,
    };
}

function restorePrismVizModelState(state) {
    setActiveEntities(state.global_entities ?? state.global_nodes);
    setActiveRelations(state.global_relations ?? state.global_edges);
    setActiveSlices(state.global_slices ?? state.global_paper_field);
    setSelectedSliceId(state.selectedSliceId ?? state.STopic ?? null);
    setFocusedSliceIndex(state.focusedSliceIndex ?? state.currentIndex ?? -1);
    setViewMode(state.viewMode ?? state.visType ?? "Prism");
    minYear = state.minYear;
    maxYear = state.maxYear;
    TTM = state.TTM;
    adjacentMatrix = state.adjacentMatrix;
    sliceRelationMatrix = state.sliceRelationMatrix;
    setActiveEntitySliceMap(state.entityIdToSliceId ?? state.paperID2topic);
    setActiveEntityTimeMap(state.entityIdToTime ?? state.paperID2year);
    global_colors = state.global_colors;
    global_keywords = state.global_keywords;
    setActiveSliceGraphs(state.sliceGraphsById ?? state.sliceGraphs ?? state.topic2graph);
    prismVizScrollOptions = state.prismVizScrollOptions || prismVizScrollOptions;
    prismRadius = state.prismRadius;
    prismScale = state.prismScale;
}

function applyPrismVizModels(model, options = {}) {
    if (!model || model.error) return model;

    setActiveEntities(cloneJSON(model.entities || model.nodes || []));
    setActiveRelations(cloneJSON(model.relations || model.edges || []));
    setActiveSlices(cloneJSON(model.slices || model.paperField || []));
    minYear = model.minYear;
    maxYear = model.maxYear;
    TTM = cloneJSON(model.ttm || {});
    sliceRelationMatrix = cloneJSON(model.sliceRelationMatrix || model.adjacentMatrix || []);
    adjacentMatrix = sliceRelationMatrix;
    setActiveEntitySliceMap(cloneJSON(model.entityIdToSliceId || model.paperID2topic || {}));
    setActiveEntityTimeMap(cloneJSON(model.entityIdToTime || model.paperID2year || {}));
    global_colors = cloneJSON(model.colorMap || {});
    global_keywords = cloneJSON(model.keywordCounts || {});
    setPrismVizScrollOptions(model);
    prismRadius = model.visual?.prismRadius;
    prismScale = model.visual?.prismScale;

    if (options.buildTopicGraphs !== false) {
        setActiveSliceGraphs(cloneJSON(model.sliceGraphsById || model.sliceGraphs || model.topicGraphs || {}));
    }

    return model;
}

function buildTopicGraphsForModel(model) {
    const previousState = snapshotPrismVizModelState();
    applyPrismVizModels(model, {
        buildTopicGraphs: false,
    });

    setActiveSliceGraphs({});
    loadSliceGraph(null);
    (model.slices || model.paperField || []).forEach(d => {
        loadSliceGraph(d.id);
    });

    const nextTopicGraphs = cloneJSON(getActiveSliceGraphs());
    restorePrismVizModelState(previousState);
    return nextTopicGraphs;
}

function preparePrismVizModels(data = authorData, fields = globalFields, config = filterConfig, options = {}) {
    const normalizedInput = normalizePrismVizInput(data, fields, config, {
        fieldMeta: options.fieldMeta || globalFieldMeta || {},
        schema: options.schema,
        fieldMap: options.fieldMap,
    });
    data = normalizedInput.data;
    fields = normalizedInput.fields;
    config = normalizedInput.config;
    const mergedConfig = {...filterConfig, ...(config || {})};
    const scrollOptions = normalizePrismVizScrollOptions(mergedConfig, options);
    const requiresTimeLayer = isLayeredScrollLayout(scrollOptions.layoutMode);
    const {modeValue, surveyValue} = getPanelFilterOptions(options);
    const threshold = Number(mergedConfig.topic_prob);
    const nodeProb = Number(mergedConfig.node_prob);
    const edgeProb = Number(mergedConfig.edge_prob);
    const fieldMeta = normalizedInput.fieldMeta || options.fieldMeta || globalFieldMeta || {};
    const fallbackTopicId = getFallbackTopicId(fields);

    let filteredEdges = cloneJSON((data?.edges || []).filter(d => Number(d.extends_prob || 0) >= edgeProb));
    let filteredNodes = cloneJSON((data?.nodes || []).filter(d => {
        const passesImportance = Number(d.isKeyPaper || 0) >= nodeProb;
        const passesLayer = !requiresTimeLayer || Number(d.year) > 1900;
        return passesImportance && passesLayer;
    }));
    const originalNodeCount = data?.nodes?.length || 0;
    const originalEdgeCount = data?.edges?.length || 0;
    const nodeCountAfterNodeFilter = filteredNodes.length;
    const edgeCountAfterEdgeFilter = filteredEdges.length;

    if (filteredNodes.length === 0) {
        return {
            error: 'NO_NODES',
            message: 'No node found in the data! Try to adjust the node probability threshold',
        };
    }

    if (surveyValue === '1') filteredNodes = filteredNodes.filter(node => !node.survey);
    const nodeCountAfterSurveyFilter = filteredNodes.length;

    const indegree = {};
    const outdegree = {};
    const alldegree = {};
    filteredNodes.forEach(node => {
        const id = String(node.id);
        outdegree[id] = 0;
        indegree[id] = 0;
        alldegree[id] = 0;
    });

    const nodeSet = new Set(filteredNodes.map(node => String(node.id)));
    const connectedEdges = [];
    filteredEdges.forEach(edge => {
        const src = String(edge.source);
        const tgt = String(edge.target);
        if (nodeSet.has(src) && nodeSet.has(tgt)) {
            outdegree[src] += 1;
            indegree[tgt] += 1;
            alldegree[src] += 1;
            alldegree[tgt] += 1;
            connectedEdges.push(edge);
        }
    });

    if (modeValue === '1') {
        filteredNodes = filteredNodes.filter(node => alldegree[String(node.id)] > 0);
    } else if (modeValue === '2') {
        filteredNodes = filteredNodes.filter(node => alldegree[String(node.id)] > 0 || Number(node.citationCount || 0) >= 50);
    }

    filteredEdges = connectedEdges;
    if (filteredNodes.length === 0) {
        return {
            error: 'NO_NODES',
            message: 'No node found in the data! Try to adjust the filters.',
        };
    }

    const years = filteredNodes.map(node => Number(node.year)).filter(year => !Number.isNaN(year));
    const modelMinYear = years.length > 0 ? Math.min(...years) : 0;
    const modelMaxYear = years.length > 0 ? Math.max(...years) : 0;

    const nodes = filteredNodes.map(node => {
        const nextNode = {...node};
        if (nextNode.topicDist === undefined || Object.keys(nextNode.topicDist).length === 0) {
            nextNode.topic = fallbackTopicId;
        }
        return nextNode;
    });
    const edges = filteredEdges.map(edge => ({
        name: `${edge.source}->${edge.target}`,
        ...edge,
    }));

    const {paperField, minSize} = buildPaperFieldModel(nodes, fields, fieldMeta, threshold);
    if (paperField.length === 0) {
        return {
            error: 'NO_TOPICS',
            message: 'No topic found in the data! Please change another scholar.',
        };
    }

    const allDocuments = nodes.map(d => [d.name, d.name, d.name, d.abstract].join(' '));
    const allDocumentSets = allDocuments.map(doc => new Set(doc.toLowerCase().split(/\W+/)));
    const text = allDocuments.join(' ');
    const keywords = paperField.map(d => d.name).join(' ').split(' ');
    const keywordCounts = countKeywords(text, keywords);
    paperField.forEach(d => {
        d.text = nodes.filter(node => hasSliceWithThreshold(node, d.id, threshold)).map(node => [node.name, node.name, node.name, node.abstract].join(' ')).join(' ');
        d.tfidf = calculateTFIDF(d.text, d.name.split(' '), allDocumentSets);
        d.sortedName = sortTopicsBy(d.fullName || d.name, d.tfidf);
    });

    const colorMap = assignTopicColors(paperField, options.colorMap || global_colors, fieldMeta);
    const paperFieldTopicSet = new Set(paperField.map(d => String(d.id)));
    const paperID2topicModel = {};
    const paperID2yearModel = {};
    nodes.forEach(node => {
        const topicCandidates = [node.topic, ...Object.keys(node.topicDist || {})]
            .filter(topic => !isNull(topic))
            .map(topic => String(topic))
            .filter(topic => paperFieldTopicSet.has(topic));

        node.topic = topicCandidates.length === 0 ? null : topicCandidates[0];
        paperID2topicModel[node.id] = node.topic;
        paperID2yearModel[node.id] = node.year;
    });

    const ratio = Math.pow(nodes.length / 10, 1 / 12);
    const ttm = buildTopicTransitionMatrix(nodes, edges, threshold);
    const modelAdjacentMatrix = buildAdjacentMatrixFromTTM(paperField, ttm);
    const baseModel = {
        config: mergedConfig,
        layoutMode: scrollOptions.layoutMode,
        scrollRenderer: scrollOptions.scrollRenderer,
        scroll: scrollOptions,
        filters: {
            modeValue,
            surveyValue,
            nodeProb,
            edgeProb,
            topicProb: threshold,
        },
        metrics: {
            originalNodeCount,
            originalEdgeCount,
            nodeCountAfterNodeFilter,
            nodeCountAfterSurveyFilter,
            edgeCountAfterEdgeFilter,
            filteredNodeCount: nodes.length,
            filteredEdgeCount: edges.length,
            topicCount: paperField.length,
            topicMinSize: minSize,
        },
        nodes,
        edges,
        entities: nodes,
        relations: edges,
        paperField,
        slices: paperField,
        minYear: modelMinYear,
        maxYear: modelMaxYear,
        ttm,
        adjacentMatrix: modelAdjacentMatrix,
        sliceRelationMatrix: modelAdjacentMatrix,
        paperID2topic: paperID2topicModel,
        paperID2year: paperID2yearModel,
        entityIdToSliceId: paperID2topicModel,
        entityIdToTime: paperID2yearModel,
        colorMap,
        keywordCounts,
        topicGraphs: {},
        sliceGraphs: {},
        sliceGraphsById: {},
        visual: {
            prismRadius: basePrismRadius * ratio,
            prismScale: basePrismScale / ratio,
        },
    };

    const topicGraphs = options.buildTopicGraphs === false ? {} : buildTopicGraphsForModel(baseModel);
    return {
        ...baseModel,
        topicGraphs,
        sliceGraphs: topicGraphs,
        sliceGraphsById: topicGraphs,
        componentModels: {
            tree: {
                rows: options.treeRows || null,
            },
            chord: {
                adjacentMatrix: modelAdjacentMatrix,
                sliceRelationMatrix: modelAdjacentMatrix,
                paperField,
                slices: paperField,
                selectedTopicId: options.selectedTopicId ?? getSelectedSliceId() ?? null,
                selectedSliceId: options.selectedSliceId ?? options.selectedTopicId ?? getSelectedSliceId() ?? null,
                polygenView,
            },
            prism: {
                topics: paperField,
                slices: paperField,
                topicGraphs,
                sliceGraphs: topicGraphs,
                sliceGraphsById: topicGraphs,
            },
            scrollByTopic: topicGraphs,
            scrollBySlice: topicGraphs,
            scrollBySliceId: topicGraphs,
        },
    };
}
function loadGlobalData() {
    const time = new Date().getTime();
    const model = preparePrismVizModels(authorData, globalFields, filterConfig, {
        ...getPanelFilterOptions(),
        fieldMeta: globalFieldMeta,
    });

    if (model.error) {
        if (model.error === 'NO_TOPICS') alert(model.message);
        else console.warn(model.message);
        return;
    }

    applyPrismVizModels(model);
    debugLog('preparePrismVizModels complete', new Date().getTime() - time, model);

    $('#node-num').text(`${model.metrics.filteredNodeCount} (filter) / ${model.metrics.originalNodeCount}`);
    $('#edge-num').text(`${model.metrics.filteredEdgeCount} (filter) / ${model.metrics.originalEdgeCount}`);
    setTextForIds(["entity-value", "node-value"], model.metrics.filteredNodeCount);
    setTextForIds(["relation-value", "edge-value"], model.metrics.filteredEdgeCount);
}

function op(key){
    return function(value1, value2){
    // 对属性的访问，obj["key"]与obj.key都是可以的，不过，如果key值并不确定，而是一个变量的时候，则只能通过obj[key]的方式访问。
        var val1 = value1[key];//这块用.key数组没有发生变化
        var val2 = value2[key];
        return val2 - val1;
    }
}

function getTopicList(node) {
    if (node.hasOwnProperty('topicDist')) {
        let topicList = [];
        let threshold = filterConfig['topic_prob'];
        for (let key in node.topicDist) {
            if (node.topicDist[key] >= threshold)  topicList.push(key);
        }
        if (!topicList.includes(node.topic))  topicList.push(node.topic);
        return topicList;
    }
    return [node.topic];
}

function getAdjacentMatrix(arrangement=null) {
    if (arrangement === null) {
        arrangement = getActiveSlices().map(d => d.id);
    }
    let matrix = [];
    arrangement.forEach((src, i) => {
        matrix.push([]);
        arrangement.forEach((tgt, j) => {
            matrix[i].push(TTM[src] && TTM[src][tgt] ? TTM[src][tgt] : 0);
        });
    }
    );
    return matrix;
}

function polarToCartesian(radius, angle) {
    return {
        x: radius * Math.cos(angle - Math.PI / 2),
        y: radius * Math.sin(angle - Math.PI / 2)
    };
}

function lineIntersection(angle, point1, point2) {
    // console.log('intersect', angle, point1, point2);

    // 通过给定角度计算直线的斜率和截距
    const m1 = Math.tan(angle - Math.PI / 2);
    const b1 = 0;  // 给定角度的直线通过原点

    // 通过两个点计算另一条直线的斜率和截距
    const m2 = (point2.y - point1.y) / (point2.x - point1.x);
    const b2 = point1.y - m2 * point1.x;

    // 如果两条直线平行，则没有交点
    if (m1 === m2) {
        return null;
    }

    // 计算交点
    const intersectX = (b2 - b1) / (m1 - m2);
    const intersectY = m1 * intersectX;

    // console.log('intersect', intersectX, intersectY);

    return {
        x: intersectX,
        y: intersectY
    };
}

function sumRowsAndColumns(matrix) {
    if (!Array.isArray(matrix) || matrix.length === 0) {
        return { rowSums: [], colSums: [] };
    }
    let rowSums = matrix.map(row => row.reduce((a, b) => a + b, 0));
    let colSums = matrix[0].map((_, colIndex) => matrix.reduce((sum, row) => sum + row[colIndex], 0));

    return { rowSums, colSums }; // 返回一个对象
}

function adjustWeight(weights) {
    let minimalRatio = 1 / weights.length / 2; // 最小比例
    // 定义一个函数来判断是否满足条件
    function satisfiesCondition(alpha) {
        let newWeights = weights.map(weight => weight + alpha);
        let newTotalWeight = d3.sum(newWeights);
        return newWeights.every(weight => (weight / newTotalWeight) > minimalRatio);
    }
    // 采用二分查找法找到满足条件的最小 alpha
    function findAlpha() {
        let left = 0, right = 1000; // 初始化搜索范围
        let precision = 1e-6;      // 精度设置

        while ((right - left) > precision) {
            let mid = (left + right) / 2;
            if (satisfiesCondition(mid)) right = mid;
            else left = mid;
        }
        return left; // 或者 return right，最终两者会趋近
    }
    let alpha = findAlpha();
    return weights.map(weight => weight + alpha);
}

function init_chord(isPolygenView=false, 
        allowInteraction=true, 
        drawRibbon=true,
        outonly=true,
        allowReaction=true
    ) {
    // 创建一个无主的SVG元素
    let width = prismRadius * 2;
    let height = width;
    let svgElement = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svgElement.setAttribute("width", width);
    svgElement.setAttribute("height", height);
    svgElement.setAttribute("viewBox", [-width / 2, -height / 2, width, height]);

    let svg = d3.select(svgElement)
        .attr("style", "width: 100%; height: auto; font: 10px Archivo Narrow;");


    let outerRadius = Math.min(width, height) * 0.5;
    if (!isPolygenView) outerRadius*=0.8
    let innerRadius = outerRadius - 20;
    const activeMatrix = getActiveSliceRelationMatrix();
    const activeSlices = getActiveSlices();
    let { rowSums: outdegree, colSums: indegree } = sumRowsAndColumns(activeMatrix); // 解构赋值
    debugLog('loadData chord', activeMatrix, outdegree, indegree);

    let sizes = activeSlices.map(d => d.size);
    let names = activeSlices.map(d => getSliceLabelText(d, "chord")),
        colors = activeSlices.map(d => sliceColor(d.id));
    
    // 使用outdegree而不是size/num作为权重
    let originalWeights = outonly? outdegree: sizes;
    let weights = JSON.parse(JSON.stringify(originalWeights));
    if (isPolygenView) weights = adjustWeight(weights);

    let degree = outdegree.map((d, i) => d + indegree[i]);

    let totalWeight = d3.sum(weights);
    let interval = 0;
    if (!isPolygenView){
        interval = totalWeight / 100;
        totalWeight += interval * names.length;
    }
    debugLog(weights, totalWeight, interval);

    debugLog('degree', degree);
    const angleScale = d3.scaleLinear().domain([0, totalWeight]).range([0, 2 * Math.PI]);
    let cumulativeAngle = 2 * Math.PI;
    const nodeAngles = weights.map((weight, ix) => {
        const endAngle = cumulativeAngle;
        cumulativeAngle -= angleScale(weight);
        const startAngle = cumulativeAngle;
        cumulativeAngle -= angleScale(interval);
        return {
            index: ix,
            startAngle: startAngle,
            endAngle: endAngle,
            weight: weight
        };
    });

    const chords = [];
    let angles = JSON.parse(JSON.stringify(nodeAngles));
    activeMatrix.forEach((row, i) => {
        row.forEach((value, j) => {
            if (outonly) {
                let rvalue = activeMatrix[j]?.[i] || 0;
                if (i < j && value + rvalue > 0) {
                    const source = nodeAngles[i];
                    const target = nodeAngles[j];
                    let sourceAngle = angleScale(value / originalWeights[i] * source.weight);
                    let targetAngle = angleScale(rvalue / originalWeights[j] * target.weight);
                    chords.push({
                        source: {
                            index: i,
                            startAngle: source.startAngle,
                            endAngle: source.startAngle + sourceAngle,
                            value: value
                        },
                        target: {
                            index: j,
                            startAngle: target.endAngle - targetAngle,
                            endAngle: target.endAngle,
                            value: rvalue
                        }
                    });
                    source.startAngle += sourceAngle;
                    target.endAngle -= targetAngle;
                }

            } else if (value > 0) {
                const source = nodeAngles[i];
                const target = nodeAngles[j];
                chords.push({
                    source: {
                        index: i,
                        startAngle: source.startAngle,
                        endAngle: source.startAngle + angleScale(value / degree[i] * source.weight),
                        value: value
                    },
                    target: {
                        index: j,
                        startAngle: target.endAngle - angleScale(value / degree[j] * target.weight),
                        endAngle: target.endAngle,
                        value: value
                    }
                });
                source.startAngle += angleScale(value / degree[i] * source.weight);
                target.endAngle -= angleScale(value / degree[j] * target.weight);
            }
        });
    });
    angles.forEach((d, i) => d.splitAngle = nodeAngles[i].startAngle)
    debugLog('angles', angles)
    debugLog('chords', chords)

    function highlight_arc(index) {
        chord_arcs.style("opacity", defaultOpacity / 3);
        chord_ribbons.style("opacity", defaultOpacity / 3);
    
        chord_arcs.filter(`.chord-arc-${index}`).style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-from-${index}`).style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-to-${index}`).style("opacity", 1);
    
        let s = `${names[index]}(#entity: ${sizes[index]}, out: ${outdegree[index]}, in: ${indegree[index]})`
        tip.show({name: s})
    }

    function highlight_ribbon(d) {
        const sourceIndex = d.source.index;
        const targetIndex = d.target.index;
        // 将所有元素透明度设为默认值的一半 .transition()
        chord_arcs.style("opacity", defaultOpacity / 3);
        chord_ribbons.style("opacity", defaultOpacity / 3);
    
        // 高亮特定元素
        chord_arcs.filter(`.chord-arc-${sourceIndex}, .chord-arc-${targetIndex}`)
            .style("opacity", 1);
        chord_ribbons.filter(`.chord-ribbon-${sourceIndex}-${targetIndex}`)
            .style("opacity", 1);

        let s = `${names[d.source.index]}(${d.source.value}) ⇒ ${names[d.target.index]}`
        if (outonly) s = `${names[d.source.index]}(${d.source.value}) ⇔ ${names[d.target.index]}(${d.target.value}) `
        tip.show({name: s})
    }
    
    function mouseout() {
        // 将所有元素的透明度恢复为默认值
        const activeIndex = getFocusedSliceIndex();
        if (activeIndex != -1) {
            chord_arcs.style("opacity", defaultOpacity / 3);
            chord_ribbons.style("opacity", defaultOpacity / 3);
            chord_arcs.filter(`.chord-arc-${activeIndex}`).style("opacity", 1);
            chord_ribbons.filter(`.chord-ribbon-from-${activeIndex}, .chord-ribbon-to-${activeIndex}`).style("opacity", 1);
        } else {
            chord_arcs.style("opacity", defaultOpacity);
            chord_ribbons.style("opacity", defaultOpacity);
        }

        tip.hide()
    }

    if (outonly) {
        let defs = svg.append("defs");
        chords.forEach((d, i) => {
            let gradient = defs.append("linearGradient")
                .attr("id", `chordgradient-${i}`)
                .attr("gradientUnits", "userSpaceOnUse")
                .attr("x1", Math.cos(d.source.startAngle - Math.PI / 2) * innerRadius)
                .attr("y1", Math.sin(d.source.startAngle - Math.PI / 2) * innerRadius)
                .attr("x2", Math.cos(d.target.startAngle - Math.PI / 2) * innerRadius)
                .attr("y2", Math.sin(d.target.startAngle - Math.PI / 2) * innerRadius);
        
            gradient.append("stop")
                .attr("offset", "0%")
                .attr("stop-color", colors[d.source.index]);
        
            gradient.append("stop")
                .attr("offset", "100%")
                .attr("stop-color", colors[d.target.index]);
        });
    }

    if (isPolygenView) {
        // 计算多边形的顶点。添加多边形蒙版。
        const polygonPoints = angles.map(d => {
            const startPoint = polarToCartesian(innerRadius - 5, d.startAngle);
            const endPoint = polarToCartesian(innerRadius - 5, d.endAngle);
            return [endPoint, startPoint];
        }).flat();

        const polygonChunks = angles.map(d => {
            const innerStart = polarToCartesian(innerRadius, d.startAngle);
            const innerEnd = polarToCartesian(innerRadius, d.endAngle);
            const outerStart = polarToCartesian(outerRadius, d.startAngle);
            const outerEnd = polarToCartesian(outerRadius, d.endAngle);
            const intersect = lineIntersection(d.splitAngle, innerStart, innerEnd);
            let ret = [innerStart, innerEnd, outerEnd, outerStart];

            Object.assign(ret, {
                radius: Math.sqrt(intersect.x ** 2 + intersect.y ** 2),
                splitAngle: d.splitAngle,
            })
            return ret;
        });
        
        // 创建蒙版
        const mask = svg.append("defs")
            .append("mask")
            .attr("id", "polygon-mask");
        
        mask.append("polygon")
            .attr("points", polygonPoints.map(d => `${d.x},${d.y}`).join(" "))
            .attr("fill", "white");
        
        // 给svg添加一个背景
        svg.append("rect")
            .attr("x", -width / 2)
            .attr("y", -height / 2)
            .attr("width", width)
            .attr("height", height)
            .attr("fill", "white")
            .attr("mask", "url(#polygon-mask)");
        // 应用蒙版到chords
        if (drawRibbon)
        svg.append("g")
            .attr("fill-opacity", defaultOpacity)
            .selectAll("path")
            .data(chords)
            .join("path")
            .attr("mask", "url(#polygon-mask)")  // 应用蒙版
            .style("mix-blend-mode", "multiply")
            // .attr("fill", d => colors[d.source.index])
            .attr("fill", (d, i) => outonly? `url(#chordgradient-${i})`: colors[d.source.index])
            .attr('class', d => `chord-ribbon chord-ribbon-from-${d.source.index} chord-ribbon-to-${d.target.index} chord-ribbon-${d.source.index}-${d.target.index}`)
            .attr("d", d3.ribbon()
                .radius(innerRadius - 5)
            )
            .on("mouseover", allowInteraction? highlight_ribbon: null)
            .on("mouseout", allowInteraction? mouseout: null)
            .append("title")
            .text(d => `\n${d.target.value} ${names[d.source.index]} → ${names[d.target.index]}`);
        
        polygonChunks.forEach((chunk, ix) => {
            // console.log('chunk', chunk)
            svg.append("polygon")
                .style("opacity", defaultOpacity)
                .attr('class', 'chord-arc chord-arc-' + ix)
                .attr("points", chunk.map(d => `${d.x},${d.y}`).join(" "))
                .attr("fill", d => {
                    let c = colors[ix];
                    return hsvToColor([c.h, c.s, c.v], 0.8)
                })
                .on("mouseover", allowInteraction? d=>highlight_arc(ix): null)
                .on("mouseout", allowInteraction? mouseout: null);
        });
    } else {
        const group = svg.append("g")
            .selectAll("g")
            .data(angles)
            .join("g");

        group.append("path")
            .attr("fill", d => {
                let c = colors[d.index];
                return hsvToColor([c.h, c.s, c.v], 0.8)
            })
            .attr("d", d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(d=>{
                    if (!outonly) return outerRadius;
                    let size = getActiveSlices().map(d => d.size)[d.index];
                    return innerRadius + size;
                })
                .startAngle(d => d.startAngle)
                .endAngle(d => d.endAngle)
            )
            .style("opacity", defaultOpacity)
            .attr('class', d => 'chord-arc chord-arc-' + d.index)
            .on("mouseover", allowInteraction? d=> highlight_arc(d.index): null)
            .on("mouseout", allowInteraction? mouseout: null);
        
        group.append("text")
            .each(d => { d.angle = (d.startAngle + d.endAngle) / 2; })
            .attr("dy", ".35em")
            .attr("transform", d => `
                rotate(${(d.angle * 180 / Math.PI - 90)})
                translate(${outerRadius})
                ${(d.angle > Math.PI ? "rotate(180)" : "")}
            `)
            .attr("text-anchor", d => d.angle > Math.PI ? "end" : "start")
            .text(d => names[d.index])
            .style("font-size", d=>Math.cbrt(sizes[d.index]) * 20 + 'px')
            .style("fill", "#000");


        if (!outonly)
        group.append("path")
            .attr("fill", d => {
                let c = colors[d.index];
                return hsvToColor([c.h, c.s, c.v], 0.8)
            })
            .attr("d", d3.arc()
                .innerRadius(innerRadius-10)
                .outerRadius(outerRadius+10)
                .startAngle(d => d.splitAngle - 0.003)
                .endAngle(d => d.splitAngle + 0.003)
            )
            .attr('class', d => 'chord-arc chord-arc-' + d.index)
            .on("mouseover", allowInteraction? d=> highlight_arc(d.index): null)
            .on("mouseout", allowInteraction? mouseout: null);
        
        if (drawRibbon)
        svg.append("g")
            .attr("opacity", defaultOpacity)
            .selectAll("path")
            .data(chords)
            .join("path")
            .style("mix-blend-mode", "multiply")
            .attr('class', d => `chord-ribbon chord-ribbon-from-${d.source.index} chord-ribbon-to-${d.target.index} chord-ribbon-${d.source.index}-${d.target.index}`)
            .attr("fill", (d, i) => outonly? `url(#chordgradient-${i})`: colors[d.source.index])
            .attr("d", d3.ribbon()
                .radius(innerRadius - 5)
            )
            .on("mouseover", allowInteraction? highlight_ribbon: null)
            .on("mouseout", allowInteraction? mouseout: null)
        
    }

    // 每次生成新的SVG元素时，我们都需要更新选择器
    return svgElement;
}

async function saveall() {
    let svgDataList = [];
    const svgElement2 = document.querySelector(`${getContainerSelector("tagCloud")} svg`);
    let svgData2 = new XMLSerializer().serializeToString(svgElement2);
    svgDataList.push(svgData2);
    
    const sortedData = getActiveSlices().sort((a, b) => b.size - a.size);
    sortedData.forEach(data => {
        topic = data.id;
        debugLog('save topic', topic);
        setSelectedSliceId(topic);
        showGeneticFlow()
        const svgElement = document.querySelector(`${getContainerSelector("scrollPanel")} svg`);
        let svgData = new XMLSerializer().serializeToString(svgElement);
        svgDataList.push(svgData);
    })
    setSelectedSliceId(null);
    showGeneticFlow()
    const svgElement = document.querySelector(`${getContainerSelector("scrollPanel")} svg`);
    let svgData = new XMLSerializer().serializeToString(svgElement);
    svgDataList.push(svgData);
    // 在最底下重复一次tagcloud
    svgDataList.push(svgData2);

    // 直接以时间戳命名
    let timestamp = new Date().toISOString().replace(/[-:.]/g, '');
    combineAndDownloadSVG(svgDataList, `${timestamp}.svg`);
}

function dicToPrettyString(dic) {
    let items = Object.entries(dic);
    items.sort((a, b) => b[1] - a[1]);
    let s = items.map(d => `${d[0]}: ${d[1]}`).join('\n');
    return s;
}

function drawSliceTags() {
    const selector = getContainerSelector("tagCloud");
    let ele = d3.select(selector).node();
    if (!ele) return;
    d3.select(selector).selectAll("*").remove();
    hideFloatingTips();
    d3.selectAll(".d3-tip").remove();
    let svg = d3.select(selector).append("svg")
        .attr("width", ele.getBoundingClientRect().width)
        .attr("height", ele.getBoundingClientRect().height)
        .style("background", "transparent");

    tip = d3.tip()
        .attr("class", "d3-tip")
        .html(d => d.name);
    svg.call(tip);

    // let paper_field_filter = global_paper_field.filter(item => item.size >= min && item.size <= max);
    let sortedData = [...getActiveSlices()].sort((a, b) => b.size - a.size);
    const wordCloud = svg.append("g");
    debugLog('[drawSliceTags]sortedData', sortedData);

    let maxFontSize = 60 * (tagScalePercent / 100);
    let wordPositions = null;
    while ((wordPositions = calculateSliceTagPositions(sortedData, maxFontSize)) === null) {
        maxFontSize *= 0.95;
    }

    if (!Array.isArray(wordPositions) || wordPositions.length === 0) {
        return;
    }

    wordCloud.selectAll("rect")
        .data(wordPositions)
        .enter()
        .append("rect")
        .attr("class", d => `tag-rect slice-tag-rect slice-tag-rect-${d.id}`)
        .attr("x", d => d.x)
        .attr("y", d => d.y)
        .attr("id", d => `rect_${d.id}`)
        .attr("width", d => d.width)
        .attr("height", d => d.height)
        .attr("rx", d => maxFontSize * 0.1 * d.ratio)
        .attr("ry", d => maxFontSize * 0.1 * d.ratio)
        .style("fill", d => sliceColor(d.id))
        //rgba(15, 161, 216, ${d.opacity})
        //`rgb(${d.rgb[0]}, ${d.rgb[1]}, ${d.rgb[2]})`
        .style("fill-opacity", 0.6)
        .on('mouseover', function(d) {
            highlightSlice(d.id);
            tip.show(d);
            d3.select(this).attr('cursor', 'pointer');
        })
        .on('mouseout', function() {
            tip.hide();
            resetSliceHighlight();
        })
        .on('click',  function(d) {
            tip.hide(d);
            handleSliceTagClick(d.id, "tagcloud");
        })

    wordCloud.selectAll("text")
        .data(wordPositions)
        .enter()
        .append("text")
        .text(d => getSliceLabelText(d))
        .attr("x", d => d.x + d.width * 0.5)  // Adjusted to the center of the rectangle
        .attr("y", d => d.y + d.height / 2) // Adjusted to the center of the rectangle
        .attr("dy", "0.35em")
        .attr("text-anchor", "middle")        // Center the text horizontally
        .style("font-family", `"Archivo Narrow", "Noto Sans SC", "Microsoft YaHei", sans-serif`)
        // .attr("dominant-baseline", "middle")  // Center the text vertically
        .attr("class", d => `tag-text slice-tag-text slice-tag-text-${d.id}`)
        .attr("id", d => `text_${d.id}`)
        .attr("font-size", d => d.size + "px")
        .style("fill", d => `rgb(0,0,0)`)
        .attr("pointer-events", "none");

    draw_chord();
    if (getSelectedSliceId() != null) highlight_tag(getSelectedSliceId(), true);
}

function layoutTagPositions(sortedData, maxFontSize) {
    let ele = d3.select(getContainerSelector("tagCloud")).node();
    if (!ele) return [];
    let svgWidth = ele.getBoundingClientRect().width;
    let svgHeight = ele.getBoundingClientRect().height;
    let minFontSize = 8;
    let horizontalGap = Math.max(maxFontSize * 0.12, 10);
    let verticalGap = Math.max(maxFontSize * 0.08, 6);
    let leftRightPadding = 16;
    let topPadding = 10;
    let bottomPadding = 24;
    let rows = [];
    let currentRow = [];
    let currentRowWidth = 0;

    for (const slice of sortedData) {
        let ratio = Math.sqrt(slice.size / sortedData[0].size);
        if (ratio * maxFontSize < minFontSize) {
            ratio = minFontSize / maxFontSize;
        }

        const size = ratio * maxFontSize;
        const labelText = getSliceLabelText(slice);
        const textMetrics = textSize(labelText, size);
        const horizontalPadding = Math.max(size * 0.72, 16);
        const width = textMetrics.width + horizontalPadding * 2;
        const height = Math.max(textMetrics.height * 1.45, size * 1.42);
        const rowWidthIfAdded = currentRow.length === 0 ? width : currentRowWidth + horizontalGap + width;

        if (width > svgWidth - leftRightPadding * 2) return null;

        if (rowWidthIfAdded > svgWidth - leftRightPadding * 2 && currentRow.length > 0) {
            rows.push({
                items: currentRow,
                width: currentRowWidth,
                height: d3.max(currentRow, item => item.height),
            });
            currentRow = [];
            currentRowWidth = 0;
        }

        currentRow.push({
            ...slice,
            size,
            width,
            height,
            ratio,
        });
        currentRowWidth = currentRow.length === 1 ? width : currentRowWidth + horizontalGap + width;
    }

    if (currentRow.length > 0) {
        rows.push({
            items: currentRow,
            width: currentRowWidth,
            height: d3.max(currentRow, item => item.height),
        });
    }

    const totalHeight = rows.reduce((sum, row) => sum + row.height, 0) + verticalGap * Math.max(rows.length - 1, 0);
    const availableHeight = svgHeight - topPadding - bottomPadding;
    if (totalHeight > availableHeight) return null;

    let yCursor = topPadding + Math.max(availableHeight - totalHeight, 0);
    const positions = [];

    rows.forEach(row => {
        let xCursor = leftRightPadding + Math.max((svgWidth - leftRightPadding * 2 - row.width) / 2, 0);
        row.items.forEach(item => {
            positions.push({
                ...item,
                x: xCursor,
                y: yCursor + (row.height - item.height) / 2,
            });
            xCursor += item.width + horizontalGap;
        });
        yCursor += row.height + verticalGap;
    });

    return positions;
}

function calculateSliceTagPositions(sortedData, maxFontSize) {
    return layoutTagPositions(sortedData, maxFontSize);
}

function textSize(text, size) {
    let container = d3.select('body').append('svg');
    container.append('text')
      .style("font-size", size + "px")      // todo: these need to be passed to the function or a css style
      .style("font-family", `"Archivo Narrow", "Noto Sans SC", "Microsoft YaHei", sans-serif`)
      .text(text);
  
    let sel = container.selectAll('text').node();
    let width = sel.getComputedTextLength();
    let height = sel.getExtentOfChar(0).height;
    container.remove();
    return {width, height};
}

function splitSliceShortName(shortName) {
    const label = String(shortName || "");
    const words = label.split(/\s+/).filter(Boolean);
    if (words.length >= 2) return [words[0], words.slice(1).join(" ")];

    const chars = Array.from(label);
    if (chars.length > 6) {
        const splitIndex = Math.ceil(chars.length / 2);
        return [chars.slice(0, splitIndex).join(""), chars.slice(splitIndex).join("")];
    }

    return [label, ""];
}

function stopPrismRotationLoop() {
    if (prismAnimationFrame != null) {
        cancelAnimationFrame(prismAnimationFrame);
        prismAnimationFrame = null;
    }
}

function stopRotateToAnimation(restoreSpeed = false) {
    if (prismRotateToFrame != null) {
        cancelAnimationFrame(prismRotateToFrame);
        prismRotateToFrame = null;
    }

    if (restoreSpeed && prismRotateToRestoreSpeed != null) {
        rotationSpeed = prismRotateToRestoreSpeed;
    }
    prismRotateToRestoreSpeed = null;
}

function scheduleResponsiveRefresh() {
    const refresh = () => {
        responsiveRefreshFrame = null;
        responsiveRefreshTimer = null;
        hideFloatingTips();
        stopRotateToAnimation(true);
        render();
        drawSliceTags();
        updateSider();
    };

    if (responsiveRefreshFrame != null) {
        cancelAnimationFrame(responsiveRefreshFrame);
        responsiveRefreshFrame = null;
    }
    if (responsiveRefreshTimer != null) {
        clearTimeout(responsiveRefreshTimer);
        responsiveRefreshTimer = null;
    }

    responsiveRefreshFrame = requestAnimationFrame(() => {
        responsiveRefreshFrame = requestAnimationFrame(refresh);
    });
    responsiveRefreshTimer = setTimeout(refresh, 180);
}
function hideAll() {
    const scrollPanel = getContainerElement("scrollPanel");
    if (scrollPanel) $(scrollPanel).hide();
    $(getContainerSelector("prismPanel")).hide();
}

function ensureScrollDebugContainer() {
    if (getContainerElement("scrollPanel")) return true;

    const drawArea = getContainerElement("drawArea");
    if (!drawArea) return false;

    const scrollDiv = document.createElement("div");
    scrollDiv.id = getContainerId("scrollPanel");
    scrollDiv.style.position = "absolute";
    scrollDiv.style.top = "0";
    scrollDiv.style.left = "0";
    scrollDiv.style.right = "0";
    scrollDiv.style.bottom = "0";
    scrollDiv.style.overflow = "hidden";
    scrollDiv.style.display = "none";
    scrollDiv.dataset.debugScroll = "true";

    const prismDiv = getContainerElement("prismPanel");
    drawArea.insertBefore(scrollDiv, prismDiv || null);
    return true;
}

function openScrollForSlice(sliceId, options={}) {
    reset_node(true);
    hideFloatingTips();
    const selectedSlice = selectPrismSlice(sliceId, {
        ...options,
        toggle: false,
        rotate: false,
    });

    if (selectedSlice == null) return null;
    if (!ensureScrollDebugContainer()) {
        console.warn("Scroll debug container cannot be mounted.");
        return selectedSlice;
    }

    hideAll();
    $(getContainerSelector("scrollPanel")).show();
    renderScrollPanel(getContainerId("scrollPanel"), buildScrollModel(selectedSlice, options), {
        ...options,
        withContext: !hideBackground,
        updateSider: true,
        activateVisType: true,
    });
    return selectedSlice;
}

function closeScrollToPrism(sliceId=getSelectedSliceId(), options={}) {
    reset_node(true);
    hideFloatingTips();
    setViewMode("Prism");
    stopRotateToAnimation(true);
    const scrollPanel = getContainerElement("scrollPanel");
    if (scrollPanel) $(scrollPanel).hide();
    $(getContainerSelector("tagCloud")).show();
    render();
    selectPrismSlice(sliceId, {
        rotate: options.rotate !== false,
        source: options.source || "scroll-back",
        toggle: false,
    });
    return getSelectedSliceId();
}

function showGeneticFlow() {
    if (!getContainerElement("scrollPanel")) {
        console.warn("GeneticFlow container is not mounted. Use the Scroll component path for slice details.");
        emitSliceSelection(getSelectedSliceId(), "legacy-flow-request");
        return;
    }

    hideAll()
    stopRotateToAnimation(true);
    stopPrismRotationLoop();
    $(getContainerSelector("scrollPanel")).show();
    renderScrollPanel(getContainerId("scrollPanel"), buildScrollModel(getSelectedSliceId()), {
        withContext: !hideBackground,
        activateVisType: true,
    });
}

function update_chord_element() {
    chord_arcs = d3.selectAll(".chord-arc");
    chord_ribbons = d3.selectAll(".chord-ribbon");
    index2chord_element = {};
    chord_arcs.each(function() {
        const element = d3.select(this);
        const classes = element.attr("class").split(" ");
        classes.forEach(cls => {
            if (cls.startsWith('chord-arc-')) {
                const index = cls.split('-').pop();
                if (!index2chord_element[index]) {
                    index2chord_element[index] = [];
                }
                index2chord_element[index].push(element);
            }
        });
    });
    
    chord_ribbons.each(function() {
        const element = d3.select(this);
        const classes = element.attr("class").split(" ");
        classes.forEach(cls => {
            if (cls.startsWith('chord-ribbon-from-') || cls.startsWith('chord-ribbon-to-')) {
                const index = cls.split('-').pop();
                if (!index2chord_element[index]) {
                    index2chord_element[index] = [];
                }
                index2chord_element[index].push(element);
            }
        });
    });
}

function guidence() {
    if (!localStorage.getItem('guidanceShown')) {
        document.getElementById('overlay').style.display = 'block';
        document.getElementById('info').classList.add('highlight');
        document.getElementById('info-text').style.display = 'inline';

        document.getElementById('overlay').addEventListener('click', function() {
            this.style.display = 'none';
            document.getElementById('info').classList.remove('highlight');
            document.getElementById('info-text').style.display = 'none';

            // 在localStorage中设置标记
            localStorage.setItem('guidanceShown', 'true');
        });
    }
};

function checkScreenSize() {
    if (window.innerWidth <= 800) {
        document.getElementById('screen-size-warning').style.display = 'block';
    } else {
        document.getElementById('screen-size-warning').style.display = 'none';
    }
}

function addAllListeners() {
    // 添加 switch-mode 按钮事件
    $("#switch-mode").click(function() {
        if (!getContainerElement("scrollPanel")) {
            console.warn("GeneticFlow mode is disabled for the Prism-only panel.");
            return;
        }
        setViewMode(isScrollViewMode() ? "Prism" : "Scroll");
        $(this).attr("data-tooltip", `View Mode: ${visType}`);
        setSelectedSliceId(null);
        render();
    });

    // 添加 speed 按钮事件
    $("#speed").click(function() {
        setRotationSpeedLevel((speedLevel + 1) % speedMultipliers.length);
        debugLog(`Speed changed to: ${rotationSpeed}`);
    });

    $("#rotation-speed-slider").on("input change", function() {
        setRotationSpeedLevel(this.value);
    });
    syncRotationSpeedUI();

    $("#tag-scale-slider").on("input change", function() {
        setTagScalePercent(this.value);
    });
    syncTagScaleUI();

    $("#save").click(function () {
        // var GeneticFlow = getZoomSvg('#GeneticFlow', '#maingroup');
        // var tagcloud = getZoomSvg('#tagcloud', null);
        // var fileName = `${name} (${fieldType}) GeneticFlow profile.jpg`;
        // downloadSvg([GeneticFlow, tagcloud], fileName);
        if (getSelectedSliceId() != null || isScrollViewMode()) {
            const svgElement = document.querySelector(`${getContainerSelector("scrollPanel")} svg`);
            if (!svgElement) {
                console.warn("GeneticFlow SVG is not available in Prism-only mode.");
                return;
            }
            let svgData = new XMLSerializer().serializeToString(svgElement);
            const svgElement2 = document.querySelector(`${getContainerSelector("tagCloud")} svg`);
            let svgData2 = new XMLSerializer().serializeToString(svgElement2);

            combineAndDownloadSVG([svgData, svgData2], 'download.svg');
        } else {
            debugLog('Please select a topic or switch to GeneticFlow view to save the full graph.');
        }   
        
    });
    $("#saveall").click(saveall);
    $("#fullscreen").click(toggleFullscreen)
    $("#restore").click(render);
    

    // 初始设置，第一个按钮加粗，透明度为1，其他按钮透明度为0.5
    $(".address-text button:first").css({ 'font-weight': 'bold', 'opacity': 1 });

    // 点击按钮时的事件处理
    $(".address-text button").click(function () {
        // 将所有按钮的字体设为正常，透明度为0.5
        $(".address-text button").css({ 'font-weight': 'normal', 'opacity': 0.5 });

        // 将点击的按钮加粗，透明度为1
        $(this).css({ 'font-weight': 'bold', 'opacity': 1 });
    });

    window.addEventListener('resize', onFullscreenChange);
    if (window.visualViewport) {
        window.visualViewport.addEventListener('resize', onFullscreenChange);
    }
    window.onload = checkScreenSize;
    // guidence();

    $(document).click(function(event) {
        // console.log(event.target, $(event.target).parent().parent());
        let grandma = $(event.target).parent().parent();
        if (grandma.is(getContainerSelector("drawArea")) || $(event.target).is('#background'))
            reset_node(true);
    });

    // The chord panel binds #toggle-polygen when it creates the button.
    // Rebinding it here would toggle twice in the integrated page.

    $("#mode, #node-width, #remove-survey").on('change', d=>loadAndRender());
    $("#edge-filter").on('change', function() {
        const value = this.value;
        if (value == 0) {
            d3.selectAll('.link').style('display', 'block');
        } else if (value == 1) {
            d3.selectAll('.link').style('display', 'none');
            d3.selectAll('.link_true').style('display', 'block');
        } else if (value == 2) {
            d3.selectAll('.link').style('display', 'none');
            d3.selectAll('.link_false').style('display', 'block');
        } else if (value == 3) {
            d3.selectAll('.link').style('display', 'none');
        }
    });

    $("#collapse").click(function() {
        isCollapse = !isCollapse;
        render();
    })

    $("#hide-background").click(function() {
        hideBackground = !hideBackground;
        render();
    })

    $("#regular").click(function() {
        regular = !regular;
        render();
    })

    $("#fullsize").click(function() {
        fullsize = !fullsize;
        render();
    })

    $("#enlarge").click(function() {
        enlarge += 1;
        render();
    })

    $("#edge-bundling").on('change', function() {
        edgeBundling = parseInt(this.value);
        render();
    })

    $("#node-shape").on('change', function() {
        nodeShape = parseInt(this.value);
        render();
    })

    $('#toggle-hide').click(function() {
        debugLog('toggle-hide');
        if (toolboxHidden) {
            $('#toggle-hide').html('<i class="fa-solid fa-chevron-up"></i>');
            $('#toolbox').show();
        } else {
            $('#toggle-hide').html('<i class="fa-solid fa-chevron-down"></i>');
            $('#toolbox').hide();
        }
        toolboxHidden = !toolboxHidden;
    })

    $('#showtag').click(function() {
        showtag = !showtag;
        if (showtag) {
            d3.selectAll('.text1').style('display', 'block');
        } else {
            d3.selectAll('.text1').style('display', 'none');
        }
    })

    $('#showtagcloud').click(function() {
        showtagcloud = !showtagcloud;
        if (showtagcloud) {
            $(getContainerSelector("tagCloud")).show();
        } else {
            $(getContainerSelector("tagCloud")).hide();
        }
    })

    $("#zoom-in").click(function() {
        if (!isScrollViewMode() || !getContainerElement("scrollPanel")) {
            prismScale = prismScale * 0.5 ** (-0.1);
        } else {
            zoom(getSelectedSliceId(), 1.1);
        }
        
    });
    $("#zoom-out").click(function() {
        if (!isScrollViewMode() || !getContainerElement("scrollPanel")) {
            prismScale = prismScale * 0.5 ** 0.1;
        } else {
            zoom(getSelectedSliceId(), 0.9);
        }
    });
}

function getCurrentScale(g) {
    const transform = g.attr("transform");  // 获取 transform 属性
    if (!transform) return 1;
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);  // 匹配 scale
    return scaleMatch ? parseFloat(scaleMatch[1]) : 1;  // 如果有匹配，返回 scale 值，否则返回 1
}

function getCurrentTranslate(g) {
    const transform = g.attr("transform");  // 获取 transform 属性
    if (!transform) return [0, 0]; 
    const translateMatch = transform.match(/translate\(([^,]+),\s*([^)]+)\)/);  // 匹配 translate
    return translateMatch ? [parseFloat(translateMatch[1]), parseFloat(translateMatch[2])] : [0, 0];
}

function updateTransform(g, newScale) {
    const [translateX, translateY] = getCurrentTranslate(g);  // 获取当前的平移
    const newTransform = `translate(${translateX}, ${translateY}) scale(${newScale})`;  // 构造新的 transform
    g.attr("transform", newTransform);  // 更新 g 的 transform 属性
}

function zoom(topic, scale) {
    const activeGraph = getActiveSliceGraph(topic);
    if (!activeGraph || !activeGraph.g) return;
    let g = activeGraph.g;
    const currentScale = getCurrentScale(g);  // 读取当前 scale
    const newScale = currentScale * scale;  // 放大 1.2 倍
    updateTransform(g, newScale);
}

function toggleFullscreen() {
    const container = document.getElementsByClassName("middle-column")[0];

    // 检查是否已经处于全屏状态
    const isFullscreen = document.fullscreenElement || document.webkitFullscreenElement;

    if (!isFullscreen) {
        // 进入全屏
        if (container.requestFullscreen) {
            container.requestFullscreen().then(() => {
                document.addEventListener("fullscreenchange", onFullscreenChange);
                document.addEventListener("keydown", onEscKeyPressed);
            }).catch(error => {
                console.error('Error entering fullscreen:', error);
            });
        } else if (container.webkitRequestFullscreen) {
            container.webkitRequestFullscreen().then(() => {
                document.addEventListener("webkitfullscreenchange", onFullscreenChange);
                document.addEventListener("keydown", onEscKeyPressed);
            }).catch(error => {
                console.error('Error entering fullscreen:', error);
            });
        }
    } else {
        // 退出全屏
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}

function onFullscreenChange() {
    // 在这里执行其他操作
    checkScreenSize();
    scheduleResponsiveRefresh();
}

function onEscKeyPressed(event) {
    if (event.key === "Escape") {
        if (document.exitFullscreen) {
            document.exitFullscreen();
        } else if (document.webkitExitFullscreen) {
            document.webkitExitFullscreen();
        }
    }
}
function reset_graph() {
    $("#description").hide();
    $(getContainerSelector("tagCloud")).show();
    $(getContainerSelector("scrollPanel")).show();
    d3.select(getContainerSelector("scrollPanel")).transition().duration(500).call(zoom.transform, d3.zoomIdentity);
}

function getCookie(name) {
    var r = document.cookie.match("\\b" + name + "=([^;]*)\\b");
    return r ? r[1] : undefined;
}

function getEntityListLabel(node = {}) {
    const original = node.original || {};
    return String(
        original.label
        ?? original.name
        ?? original.title
        ?? node.label
        ?? node.name
        ?? node.title
        ?? node.id
        ?? ""
    );
}

function getEntityListMeta(node = {}) {
    return String(
        node.metadata?.authors
        ?? node.meta?.authors
        ?? node.authors
        ?? ""
    );
}

function getEntityListSource(node = {}) {
    return String(
        node.source
        ?? node.venue
        ?? node.venu
        ?? node.meta?.venue
        ?? ""
    );
}

function updateSider (nodes=getActiveEntities()) {
    // feat: 在不选择话题的情况下，显示所有的节点
    if (getSelectedSliceId() == null || !nodes) nodes = authorData['nodes'];
    let totalHeight = 0;
    $(".navigation").each(function() {
        totalHeight += $(this).outerHeight(true); // 包含 padding 和 margin
    });
    var height = ($("body").height() - totalHeight) * 0.9;
    const listSelector = getContainerSelector("listPanel");
    $(listSelector).css("height", height);
    $(listSelector).empty();
    const listNameLabel = escapeHTML(labelText("listName", "Entity Name"));
    const listImpactLabel = escapeHTML(labelText("listImpact", "Impact"));
    $(listSelector).append(content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: white; display: inline-block;"></i>
        </div>
        <div style="margin-left: 7%; margin-bottom: 2%; display: flex; justify-content: space-between;">
            <b data-prismviz-label="listName" style="flex: 1 1 auto; min-width: 0; margin-left: 0%; font-size:16px;">${listNameLabel}</b>
            <b data-prismviz-label="listImpact" style="flex: 0 0 auto; margin-right: 1%; margin-left: 5%; font-size:16px;">${listImpactLabel}</b>
        </div>`
    );
    
    nodes = nodes.sort((a, b) => Number(b.impact ?? b.citationCount ?? 0) - Number(a.impact ?? a.citationCount ?? 0));
    for (let i = 0; i < nodes.length; i++) {
        const entityLabel = escapeHTML(getEntityListLabel(nodes[i]));
        const entitySource = escapeHTML(getEntityListSource(nodes[i]));
        const entityTime = String(nodes[i].time ?? nodes[i].year);

        var entityMeta = escapeHTML(getEntityListMeta(nodes[i]));
        var color = sliceColor(getActiveEntitySliceMap()[nodes[i].id], 0.7)
        var nodeId = nodes[i].id;
        var impact = nodes[i].impact ?? nodes[i].citationCount;
        if (impact == '-1') {
            impact = "not available";
        }
        var content = `
        <div style="float: left;">
            <i style="width: 10px; height: 10px; border-radius: 50%; background-color: ${color}; display: inline-block;"></i>
        </div>
        <div style="margin-left: 5%; margin-right: 3%; padding: 3%; margin-top: -3%; border-radius: 5px;" class="entity-list-item" onmouseover="d3.prismViz.highlight_node('${nodeId}', false, false)" onmouseleave="d3.prismViz.reset_node()">
            <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px; margin-bottom: 1%;">
                <span style="flex: 1 1 auto; min-width: 0; overflow-wrap: anywhere;">${entityLabel}</span>
                <span style="flex: 0 0 auto; margin-right: 2%; text-align: right;">${impact}</span>
            </div>
            <span style="color: #808080;">
                ${entityMeta}
            </span>
            <br>
            <span style="color: #808080;">${entitySource} ${entityTime}</span>
        </div>
        `;
        
        $(listSelector).append(content);
    }
    $(getEntityListSelector()).show();
}
function draw_chord() {
    const leftColumn = document.getElementsByClassName('left-column')[0];
    const sideLength = leftColumn ? leftColumn.getBoundingClientRect().width : undefined;
    renderChordContent(chordContentSelector, buildChordModel(), {
        sideLength,
        square: true,
    });
}

function highlight_arc_with_cash(index, oldIndex) {
    // 有缓存的方法，能够节约一半的时间 
    // console.log('highlight arc', index);
    if (index2chord_element[oldIndex]) {
        index2chord_element[oldIndex].forEach(element => element.style("opacity", defaultOpacity / 3));
    }
    if (index2chord_element[index]) {
        index2chord_element[index].forEach(element => element.style("opacity", 1));
    }
}

function create_svg(viewBox=undefined, transform=undefined) {
    const selector = getContainerSelector("scrollPanel");
    let ele = d3.select(selector).node();
    d3.select(selector).selectAll("*").remove();
    svgWidth = ele.getBoundingClientRect().width;
    svgHeight = ele.getBoundingClientRect().height;
    if (!viewBox) {
        viewBox = `0 0 ${svgWidth} ${svgHeight}`;
    }

    let viewBoxWidth = parseFloat(viewBox.split(' ')[2]);
    let viewBoxHeight = parseFloat(viewBox.split(' ')[3]);
    if (!transform) {
        transform = `translate(0,${viewBoxHeight})`;
    }

    svg = d3.select(selector).append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("viewBox", viewBox);

    //获取viewBox的宽度
    let moveDistance_r = Math.max(viewBoxWidth, viewBoxWidth / 2 +  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;
    let moveDistance_l = Math.min(0, viewBoxWidth / 2 -  svgWidth * viewBoxHeight / svgHeight / 2) * 0.95;

    let fixedXTranslation_r = "translate(" + moveDistance_r + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0
    let fixedXTranslation_l = "translate(" + moveDistance_l + ",0)"; // 将fixedX作为X方向的平移，Y方向保持为0

    matrixg = svg.append('g')
        .attr('transform', transform)
        .attr('id', 'maingroup');
    gr = svg.append('g')
        .attr('transform', transform + fixedXTranslation_r)
        .attr('id', 'fixedgroup_r');
    gl = svg.append('g')
        .attr('transform', transform + fixedXTranslation_l)
        .attr('id', 'fixedgroup_l');
    
    zoom = d3.zoom()
        .scaleExtent([0.05, 10])
        .on("zoom", function() {
        let currentTransform = d3.event.transform;
    
        // 应用当前的变换到主要元素组g
        matrixg.attr("transform", currentTransform.toString() + " " + transform);
    
        // 为了在Y方向上保持GeneticFlow元素的同步移动，我们需要提取当前变换的平移和缩放值
        // 并仅将这些应用到Y坐标，而X坐标保持不变（假定fixedX为X坐标的固定值）
        
        let yTranslation = "translate(0," + currentTransform.y + ")"; // 应用当前Y方向的平移
        let yScale = "scale(1," + currentTransform.k + ")"; // 在Y方向上应用缩放，X方向保持1
    
        // 将上述变换组合并应用到GeneticFlow
        // 注意这里我们使用了空格来分隔不同的变换指令
        gr.attr("transform", yTranslation + yScale + transform + fixedXTranslation_r);
        gl.attr("transform", yTranslation + yScale + transform + fixedXTranslation_l);
    });
    svg.call(zoom);
}


function mouseoverEdge(id, width=10, color='red') {
    d3.selectAll('#' + selectorById(id))
        .style("stroke", color)
        .style("stroke-width", d => width || d.width)
        .attr('cursor', 'pointer');
    d3.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", color)
        .attr('cursor', 'pointer');
}

function mouseoutEdge(id) {
    if (!highlighted.includes(id)) {
        // TODO: why d is undefined???
        d3.selectAll('#' + selectorById(id)).filter(d=>d !== undefined)
            .style("stroke", d=> d.color)   // {console.log(d); return
            .style("stroke-width", d=>d.width);
        d3.selectAll('#' + selectorById(id) + '_polygon').filter(d=>d !== undefined)
            .style("fill", d=>d.color);
    }
}

function clickEdge(id, width=10) {
    highlighted = [id];
    matrixg.selectAll('.epath')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', virtualOpacity);
    matrixg.selectAll('.epath-polygon')
        .style("fill", d=>d.color)
        .style('opacity', virtualOpacity);
    d3.selectAll('#' + selectorById(id))
        .style("stroke", "red")
        .style("stroke-width", d => width || d.width)
        .style('opacity', 1);
    d3.selectAll('#' + selectorById(id) + '_polygon')
        .style("fill", "red")
        .style("opacity", 1);
    showEdgeInfo(id);
}

function perceivedToActualArea(perceived) {
    return Math.pow(perceived, 1 / 0.7);
}

function resetElementAttr(svgElement) {
    requestAnimationFrame(() => {
        let svg = d3.select(svgElement);
        let bbox = svg.node().getBBox();
        let x = bbox.x;
        let y = bbox.y;
        let width = bbox.width;
        let height = bbox.height;

        let offsetX = -x;
        let offsetY = -y;

        debugLog('reset', svg, x, y, width, height, offsetX, offsetY);

        // 重设 viewBox 和 transform
        svgElement.setAttribute('viewBox', `${x} ${y} ${width} ${height}`);
        svgElement.setAttribute('transform', `translate(${offsetX}, ${offsetY})`);
    });
}



function draw_context(graph) {
    // draw context bar
    if (!shouldRenderScrollContext(graph.scroll || graph)) return;
    if (!graph['combinedContextEdges'] || Object.keys(graph['combinedContextEdges']).length === 0) return;

    const inflowContext = {};
    const outflowContext = {};
    context_l = inflowContext;
    context_r = outflowContext;
    // topicID: {"2011": [edge1, edge2, ...], "2012": [], "total": 50}

    
    if (hideBackground) {
        processDotContext(graph);
    }
    let bbox = graph['g'].node().getBBox();
    let all_years_l = [], all_years_r = [];
    let totalWidth = bbox.width;
    for (let edge of Object.values(graph['combinedContextEdges'])) {
        let years = edge.name.split('->');
        if (edge.name[0] == "l") {
            all_years_l.push(years[0].substring(1));
        } else {
            all_years_r.push(years[1].substring(1));
        }
    }
    all_years_l = Array.from(new Set(all_years_l));
    all_years_r = Array.from(new Set(all_years_r));
    debugLog('all_years', all_years_l, all_years_r);


    for (let edge of Object.values(graph['combinedContextEdges'])) {
        const entitySliceMap = getActiveEntitySliceMap();
        if (edge.name[0] == "l") {
            let year = edge.name.split('->')[0].substring(1);
            for (let e of edge.edges) {
                let topic = entitySliceMap[e.source];
                if (inflowContext[topic] == undefined) {
                    inflowContext[topic] = {"total": 0};
                    for (let y of all_years_l) inflowContext[topic][y] = [];
                }
                inflowContext[topic][year].push(e);
                inflowContext[topic]["total"] += 1;
            }
        } else {
            let year = edge.name.split('->')[1].substring(1);
            for (let e of edge.edges) {
                let topic = entitySliceMap[e.target];
                if (outflowContext[topic] == undefined) {
                    outflowContext[topic] = {"total": 0};
                    for (let y of all_years_r) outflowContext[topic][y] = [];
                }
                outflowContext[topic][year].push(e);
                outflowContext[topic]["total"] += 1;
            }
        }
    }
    debugLog('context l/r', inflowContext, outflowContext);

    let totalSize_l = Object.values(inflowContext).reduce((acc, val) => acc + val.total, 0);
    let totalSize_r = Object.values(outflowContext).reduce((acc, val) => acc + val.total, 0);
    // let width_l = totalSize_l * totalWidth / (totalSize_l + totalSize_r);
    // let width_r = totalSize_r * totalWidth / (totalSize_l + totalSize_r);

    // draw_context_bar(graph, context_l, totalSize_l * totalWidth / (totalSize_l + totalSize_r), 'l');
    // draw_context_bar(graph, context_r, totalSize_r * totalWidth / (totalSize_l + totalSize_r), 'r');
    
    let g = graph['g'];
    let id2attr = graph['id2attr'];
    let lx = bbox.x - bbox_padding_x;
    let rx = bbox.x + bbox.width + bbox_padding_x;

    // var y = d3.scaleLinear()
    //     .domain([minYear, maxYear])
    //     .range([id2attr['l' + minYear].y, id2attr['l' + maxYear].y]);
    // 避免未定义，延伸年份
    let prefix = id2attr['l' + maxYear]? 'l' : 'year';
    let maxY = id2attr[prefix + maxYear].y;
    for (let year = maxYear + 1; year < maxYear + yearGrid; year++) {
        maxY += id2attr[prefix + maxYear].y - id2attr[prefix + (maxYear-1)].y;
        id2attr[prefix + year] = {"y": maxY};
    }
    var y = d3.scaleOrdinal()
        .domain(d3.range(minYear, maxYear + yearGrid))
        .range(d3.range(minYear, maxYear + yearGrid).map(year => id2attr[prefix + year].y));
    
    // minYear, maxYear
    var years = d3.range(minYear, maxYear + 1);
    let miny = graph.nodes.reduce((acc, val) => Math.min(acc, val.year), maxYear);
    let maxy = graph.nodes.reduce((acc, val) => Math.max(acc, val.year), minYear);
    var tickValues = years.filter(year => year % yearGrid === 0 && year >= miny && year <= maxy);
    debugLog('tickValues', tickValues, miny, maxy);

    let barHeight = Math.cbrt(bbox.width * bbox.height) / 2;
    let barWidth = bbox.width + barHeight * 2;
    let streamSize = barHeight * 2 + barWidth / 5;

    g.append("g")
        .call(d3.axisLeft(y).tickSize(- totalWidth - streamSize * 2).tickValues(tickValues))
        .select(".domain").remove();
    g.selectAll(".tick line")
        .attr("stroke", "#b8b8b8")
        // .attr("transform", `translate(${-width_l},0)`);
        .attr("transform", `translate(${-streamSize + barHeight},0)`);
    // font
    g.selectAll(".tick text")
        .attr("x", rx + streamSize + 20)
        .attr("dy", 10)
        .attr('font-family', 'Archivo Narrow')
        .style("font-size", 48)

    Tooltip = g
        .append("text")
        .attr("x", lx)
        .attr("y",  bbox.y - bbox_padding_y - barHeight)
        .attr('font-family', 'Archivo Narrow')
        .style("opacity", 0)
        .style("font-size", 48)
    
    let width_l = streamSize * totalSize_l / Math.max(totalSize_l, totalSize_r);
    let width_r = streamSize * totalSize_r / Math.max(totalSize_l, totalSize_r);
    drawStreamgraph(g, inflowContext, y, [lx, lx - width_l], 'l');
    drawStreamgraph(g, outflowContext, y, [rx, rx + width_r], 'r');
    let barHeight_l = barHeight * totalSize_l / Math.max(totalSize_l, totalSize_r);
    let barHeight_r = barHeight * totalSize_r / Math.max(totalSize_l, totalSize_r);
    draw_scrollbar(g, inflowContext, [lx - barHeight, bbox.y - barHeight_l], barWidth, barHeight_l, barHeight, 'l');
    draw_scrollbar(g, outflowContext, [lx - barHeight, bbox.y + bbox.height], barWidth, barHeight_r, barHeight, 'r');
}

function mouseoverStreamSegment(dir, sliceId, context) {
    if(activeArea) return;
    // Tooltip.style("opacity", 1);
    resetStreamContextEdgeHighlight();
    d3.selectAll(".egroup-context-slice").remove();
    let slice = getTopic(sliceId);
    let info = `${slice.shortName}, ${dir=='l'?'Influx': (dir == 'm'? 'Total': 'Efflux')}: ${context[sliceId].total}`;
    tip.show({name: info})
    Tooltip.text(info);
    d3.selectAll(".myArea").style("opacity", .2)
    d3.select(`.myArea${dir}T${sliceId}`)
        .style("stroke", "black")
        .style("opacity", 1)
    d3.selectAll(".scroll-segmentl, .scroll-segmentr" ).style("opacity", .2)
    d3.select(`.scroll-segment${dir}T${sliceId}`).style("opacity", 1)

    const activeGraph = getActiveScrollGraph();
    const activeSliceId = getSelectedSliceId();
    if (activeSliceId != null && activeSliceId != sliceId && activeGraph) {
        const streamSliceContext = context ? context[sliceId] : null;
        highlightContextEdgesForSlice(sliceId, dir, streamSliceContext);
        drawContextEdgesBySlice(activeGraph, sliceId, dir, streamSliceContext);
    }
}

const mouseoverFlux = mouseoverStreamSegment;

function mouseOverStreamSegments(flux_pairs) {
    // 仅当mouseOverNode时，与该node所有相关的fluxes高亮
    if(activeArea) return;
    d3.selectAll(".myArea").style("opacity", .2)
    d3.selectAll(".scroll-segmentl, .scroll-segmentr" ).style("opacity", .2)
    flux_pairs.forEach(pair => {
        let [dir, topic_id] = pair;
        d3.select(`.myArea${dir}T${topic_id}`)
            .style("stroke", "black")
            .style("opacity", 1)
        d3.select(`.scroll-segment${dir}T${topic_id}`).style("opacity", 1)
    });
}

const mouseOverFluxes = mouseOverStreamSegments;

function getTopic(id) {
    ret = findActiveSlice(id);
    if (ret == undefined) return {
        "shortName": "null",
        "name": "null"
    }
    return ret;
}

function mouseleaveStreamSegment() {
    if(activeArea) return;
    tip.hide();
    Tooltip.style("opacity", 0)
    d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none")
    d3.selectAll(".scroll-segmentl, .scroll-segmentr" ).style("opacity", 1)

    resetStreamContextEdgeHighlight();
    d3.selectAll(".egroup-context-slice").remove();
}

const mouseleaveFlux = mouseleaveStreamSegment;

function cancelActiveStreamSelection() {
    hideFloatingTips();
    if (tip) tip.hide();
    if (Tooltip) Tooltip.style("opacity", 0);
    if (typeof activeStreamReset === "function") {
        activeStreamReset();
        return true;
    }
    if (activeArea !== null) {
        activeArea = null;
        d3.selectAll(".entityIcon").remove();
        resetStreamContextEdgeHighlight();
        d3.selectAll(".egroup-context-slice").remove();
        d3.selectAll(".myArea").style("opacity", 1).style("stroke", "none");
        d3.selectAll(".scroll-segmentl, .scroll-segmentr").style("opacity", 1);
        return true;
    }
    return false;
}

function drawStreamgraph(svg, context, y, xRange, dir='l', selected=null) {
    debugLog('dir', dir, 'selected', selected);

    svg.selectAll(".myArea" + dir)
        .remove();

    let keys = Object.entries(context)
        .sort((a, b) => b[1].total - a[1].total)
        .map(entry => entry[0]);
    keys = JSON.parse(JSON.stringify(keys));
        let data = {};
    keys.forEach(function(key) {
        let details = context[key];
        for (var year in details) {
            if (year == 'total') continue;
            if (data[year] == undefined) data[year] = {};
            data[year][key] = details[year].length;
        }
    })
    // console.log('dataMap', JSON.parse(JSON.stringify(data)));
    data = Object.keys(data).map(function(year) {
        return {
            year: +year,
            ...data[year]
        };
    });
    if (data.length == 0) return;

    const years = data.map(d => d.year);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const dataKeys = Object.keys(data[0]).filter(key => key !== 'year');
    // 创建具有所有键和值为 0 的新对象
    const createZeroData = (year) => {
        let zeroData = { year: year };
        dataKeys.forEach(key => {
            zeroData[key] = 0;
        });
        return zeroData;
    };
    // 添加最小年份-1 和最大年份+1 的数据
    data.unshift(createZeroData(minYear - 1));
    data.push(createZeroData(maxYear + 1));
    

    var xScale = d3.scaleLinear()
        .domain([0, d3.max(data, function(d) {
        return d3.sum(keys, function(key) { return d[key]; });
        })])
        .range(xRange);

    var areaGenerator = d3.area()
        .curve(d3.curveBasis)
        .y(function(d) { return y(d.data.year); })
        .x0(function(d) { return xScale(d[0]); })
        .x1(function(d) { return xScale(d[1]); });

    debugLog('data', data);
    let sortedKeys = JSON.parse(JSON.stringify(keys));
    if (selected) {
        sortedKeys = sortedKeys.filter(function(key) { return key != keys[selected]; });
        sortedKeys.unshift(keys[selected]);
    }
    
    var stackedData = d3.stack().keys(sortedKeys)(data);
    debugLog('sortedKeys', sortedKeys, stackedData);
    
    var clickArea = function(d, i) {
        if (d3.event) d3.event.stopPropagation();
        if (activeArea === dir && i == 0) {
            cancelActiveStreamSelection();
        } else if(activeArea === null) {
            activeArea = dir;
            activeStreamReset = function() {
                activeArea = null;
                activeStreamReset = null;
                hideFloatingTips();
                if (tip) tip.hide();
                if (Tooltip) Tooltip.style("opacity", 0);
                svg.selectAll(".entityIcon").remove();
                resetStreamContextEdgeHighlight();
                d3.selectAll(".egroup-context-slice").remove();
                drawStreamgraph(svg, context, y, xRange, dir);
            };
            drawStreamgraph(svg, context, y, xRange, dir, selected=i);
        }
    }
    
    // var mousemove = function(d, i) {
    //     var grp = sortedKeys[i];
    //     // var year = y.invert(d3.mouse(this)[1]).toFixed(0);
    //     // 由于 d3.scaleOrdinal 不支持 invert 方法，你可以通过手动查找最近的年份来代替 y.invert。
    //     var mouseY = d3.mouse(this)[1];
    //     var closestYear = d3.range(minYear, maxYear + 1).reduce((prev, curr) => {
    //         return (Math.abs(y(curr) - mouseY) < Math.abs(y(prev) - mouseY) ? curr : prev);
    //     });

    //     var year = closestYear.toFixed(0);
    //     if (dir == 'l' && year % yearGrid == 0 || dir == 'r' && year % yearGrid == yearGrid-1 || year == minYear || year == maxYear || dir == 'm') {
    //         var value = d3.sum(stackedData[i], function(layer) {
    //             return layer.data.year === +year ? (layer[1] - layer[0]) : 0;
    //         }).toFixed(0);
    //         let info = `${getTopic(grp).shortName}, ${dir=='l'?'Influx': (dir == 'm'? 'Total': 'Efflux')}: ${context[grp].total}, Year: ${year}, Value: ${value}`
    //         tip.show({name: info});
    //         Tooltip.text(info);
    //     } else {
    //         tip.hide();
    //         Tooltip.style("opacity", 0);
    //     }
    // }

    // Show the areas
    svg.selectAll(".myArea" + dir)
        .data(stackedData)
        .enter()
        .append("path")
        .attr("class", d=>`myArea myArea${dir} myArea${dir}T${d.key}`)
        .style("fill", d=>sliceColor(d.key))
        .style("fill-opacity", .8)
        .attr("d", areaGenerator)
        .on("mouseover", d=>mouseoverStreamSegment(dir, d.key, context))
        // .on("mousemove", mousemove)
        .on("mouseleave", mouseleaveStreamSegment)
        .on("click", clickArea);

    // Add X axis
    // svg.append("g")
    //     .call(d3.axisBottom(xScale))
    //     .select(".domain").remove();
    
    if (selected!==null) {
        d3.selectAll(".myArea").style("opacity", .2);
        d3.selectAll(`.myArea${dir}T${keys[selected]}`)
            .style("stroke", "black")
            .style("opacity", 1);
        // 显示点阵和连线

        if (dir == 'm') return;
        let selectedKey = keys[selected];
        resetStreamContextEdgeHighlight();
        d3.selectAll(".egroup-context-slice").remove();
        const activeGraph = getActiveScrollGraph();
        const activeSliceId = getSelectedSliceId();
        if (activeSliceId != null && activeSliceId != selectedKey && activeGraph) {
            const streamTopicContext = context ? context[selectedKey] : null;
            highlightContextEdgesForSlice(selectedKey, dir, streamTopicContext);
            drawContextEdgesBySlice(activeGraph, selectedKey, dir, streamTopicContext);
        }
        var contextData = context[selectedKey];
        debugLog('contextData', contextData);
        for (var year in contextData) {
            if(year == 'total') continue;
            var details = contextData[year];
            var value = stackedData[0].find(function(layer) {
                return layer.data.year === +year;
            });
            var yPosition = y(+year);
            // 计算每个点的x坐标，使其在 (0, maxXPosition) 内均匀分布
            let papers = {}
            details.forEach(d=>{
                let paper = dir=='l'? d.source: d.target
                papers[paper] = papers[paper] === undefined? 1: papers[paper] + 1;
            })
            // sort by value
            papers = Object.entries(papers).sort((a, b) => b[1] - a[1]);
            let sqrtSize = papers.map(d=>Math.sqrt(d[1])).reduce((acc, val) => acc + val, 0);
            let size = 0;
            var xPositions = papers.map(d => {
                size += Math.sqrt(d[1]) / 3; 
                let ret = xScale(value[1] * size / sqrtSize);
                size += Math.sqrt(d[1]) / 3;
                return ret;
            });
            // console.log('papers', year, value, sqrtSize, papers, xScale(0), xPositions);
            
            // 绘制图标
            svg.selectAll(`.entityIcon${year}`)
                .data(papers)
                .enter()
                .append("g")
                .attr("class", `entityIcon entityIcon${year}`)
                .each(function(d, i) {
                    let w = h = Math.sqrt(d[1]) * 56;
                    d = findNodeById(d[0]); 
                    if (!d) return;
                    bookPaths.forEach(path => {
                        d3.select(this).append('path')
                            .attr('d', path)
                            .style('fill-opacity', 0.4)
                            .style('fill', 'red')    // updateOutlineColor(d.isKeyPaper, d.citationCount)
                            .attr('transform', `translate(${xPositions[i] - w / 2}, ${yPosition - h * 0.4}) scale(${w / bookWidth}, ${h / bookHeight})`);
                    });
                    d3.select(this).append('text')
                        .attr('x', xPositions[i])
                        .attr('y', yPosition + h * 0.1)
                        .attr('text-anchor', 'middle')
                        .attr('font-family', 'Archivo Narrow')
                        .attr('font-size', 30)
                        .attr('fill', 'black')
                        .attr("pointer-events", "none")
                        .text(d.citationCount);
                })
                .on("mouseover", function(d) {
                    const node = findNodeById(d[0]);
                    tip.show({name: (node ? node.name : d[0]) + ' ' + d[1]});
                    // cursor
                    d3.select(this).attr('cursor', 'pointer');
                })
                .on("mouseout", function() {
                    tip.hide();
                })
                .on("click", d=>highlight_node(d[0]))
        }
    }
}

function draw_scrollbar(svg, context, startPoint, width, height, baseHeight, dir='l') {
    // scroll的宽和高
    // const width = 800;
    // const height = 50;
    let currentContext = JSON.parse(JSON.stringify(context));
    let keys = Object.entries(currentContext)
        .sort((a, b) => b[1].total - a[1].total)
        .map(entry => entry[0]);
    // 根据total排序，如果是右边的scrollbar，按照total降序排列
    if (dir == 'l') {
        keys = keys.reverse();
    } 
    const barWidth = width / 5;
    let segmentColors = [],  segmentPositionX = [], segmentWidth = [];
    let startX = 0;
    let totalSize = Object.values(currentContext).reduce((acc, val) => acc + val.total, 0);
    keys.forEach(function(key) {
        let c = sliceColor(key);
        segmentColors.push(c); // hsvToColor([c.h, 0.4, 1])
        segmentPositionX.push(startX);
        segmentWidth.push(width * currentContext[key].total / totalSize);
        startX += width * currentContext[key].total / totalSize;
    });

    // Draw the end bars
    const endBarWidth = barWidth / 5;
    const endBarHeight = baseHeight * 2;
    const triangleHeight = baseHeight * 1.5;
    let radius = triangleHeight / 3;
    let rectRadius = 10;

    // console.log(barWidth, barWidth)
    // console.log('context', currentContext, segmentColors);

    const gradientDefinitions = svg.append("defs");
    // Create gradient for each segment
    segmentColors.forEach((color, i) => {
        const gradient = gradientDefinitions.append("linearGradient")
            .attr("id", `gradient${dir}${i}`)
            .attr("x1", "0%")
            .attr("x2", "0%")
            .attr("y1", "0%")
            .attr("y2", "100%");
        
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("style", `stop-color:${color};stop-opacity:1`);

        gradient.append("stop")
            .attr("offset", "50%")
            .attr("style", `stop-color:white;stop-opacity:1`);

        gradient.append("stop")
            .attr("offset", "100%")
            .attr("style", `stop-color:${color};stop-opacity:1`);
    });

    svg.selectAll(".scroll-segment" + dir)
        .data(segmentColors)
        .enter()
        .append("rect")
        .attr("class", (d, i) => `scroll-segment${dir} scroll-segment${dir}T${keys[i]}`)
        .attr("x", (d, i) => startPoint[0] + segmentPositionX[i])
        .attr("y", startPoint[1])
        .attr("width", (d, i) => segmentWidth[i])
        .attr("height", height)
        // .attr("rx", 10)
        // .attr("ry", 10)
        .attr("fill", (d, i) => `url(#gradient${dir}${i})`)
        .on("mouseover", function () {
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", function () {
            d3.select(this).attr("opacity", 1);
        })
        .on("mouseover", (d, i) => mouseoverStreamSegment(dir, keys[i], context))
        .on("mouseleave", mouseleaveStreamSegment)

    svg.selectAll(".scroll-count" + dir)
        .data(segmentColors)
        .enter()
        .append("text")
        .attr("class", `scroll-count${dir}`)
        .attr("x", (d, i) => startPoint[0] + segmentPositionX[i] + segmentWidth[i] / 2)
        .attr("y", startPoint[1] + height / 2)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", height)
        .attr("opacity", 0.7)
        .attr("fill", "black")
        .attr("dy", 5)
        .attr("pointer-events", "none")
        .text((d, i) => context[keys[i]].total == 1? '': context[keys[i]].total)
    
    svg.selectAll(".scroll-label" + dir)
        .data(segmentColors)
        .enter()
        .append("text")
        .attr("class", `scroll-label${dir}`)
        .attr("x", (d, i) => startPoint[0] + segmentPositionX[i] + segmentWidth[i] / 2)
        .attr("y", startPoint[1] + height / 2 + (dir=='l'? -height: height) * 1.5)
        .attr("transform", (d, i) => `rotate(${dir=='l'? -15: 15}, ${startPoint[0] + segmentPositionX[i] + segmentWidth[i] / 2}, ${startPoint[1] + height / 2 + (dir=='l'? -height: height)})`)
        .attr("text-anchor", "middle")
        .attr("alignment-baseline", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", height)
        .attr("opacity", 0.7)
        .attr("fill", "black")
        .attr("dy", 5)
        .attr("pointer-events", "none")
        .text((d, i) => {
            if (context[keys[i]].total <= totalSize / 15) return '';
            return getSliceLabelText(getTopic(keys[i]), "chord").replace('null', 'misc.');
        })
        

    const createEndBarGradient = (id) => {
        const gradient = gradientDefinitions.append("linearGradient")
            .attr("id", id)
            .attr("x1", "0%")
            .attr("x2", "100%")
            .attr("y1", "0%")
            .attr("y2", "100%");
    
        gradient.append("stop")
            .attr("offset", "0%")
            .attr("style", "stop-color:#8B4513;stop-opacity:1"); // 左侧暗部
    
        gradient.append("stop")
            .attr("offset", "25%")
            .attr("style", "stop-color:#A0522D;stop-opacity:1"); // 左侧过渡
    
        gradient.append("stop")
            .attr("offset", "50%")
            .attr("style", "stop-color:#CD853F;stop-opacity:1"); // 中间亮部（哑光效果）
    
        gradient.append("stop")
            .attr("offset", "75%")
            .attr("style", "stop-color:#A0522D;stop-opacity:1"); // 右侧过渡
    
        gradient.append("stop")
            .attr("offset", "100%")
            .attr("style", "stop-color:#8B4513;stop-opacity:1"); // 右侧暗部
    };

    createEndBarGradient("leftBarGradient");
    createEndBarGradient("rightBarGradient");

    // Left trapezoid
    let centerHeight = startPoint[1] + height / 2;
    svg.append("path")
        .attr("d", `
            M${0},${centerHeight - triangleHeight/2 + radius}
            A${radius},${radius} 0 0 1 ${radius},${centerHeight - triangleHeight/2}
            L${barWidth},${centerHeight}
            L${radius},${centerHeight + triangleHeight/2}
            A${radius},${radius} 0 0 1 ${0},${centerHeight + triangleHeight/2 - radius}
            Z
        `)
        .attr("fill", "url(#leftBarGradient)")
        .attr('transform', `translate(${startPoint[0] - barWidth}, 0)`);

    // Right trapezoid
    svg.append("path")
        .attr("d", `
            M${width},${centerHeight - triangleHeight/2 + radius}
            A${radius},${radius} 0 0 0 ${width - radius},${centerHeight - triangleHeight/2}
            L${width - barWidth},${centerHeight}
            L${width - radius},${centerHeight + triangleHeight/2}
            A${radius},${radius} 0 0 0 ${width},${centerHeight + triangleHeight/2 - radius}
            Z
        `)
        .attr("fill", "url(#rightBarGradient)")
        .attr('transform', `translate(${startPoint[0] + barWidth}, 0)`);

    // Left end bar
    svg.append("rect")
        .attr("x", startPoint[0] - endBarWidth)
        .attr("y", centerHeight - endBarHeight/2)
        .attr("width", endBarWidth)
        .attr("height", endBarHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
        .attr("fill", "url(#leftBarGradient)");

    svg.append("rect")
        .attr("x", startPoint[0] - endBarWidth - endBarWidth / 4)
        .attr("y", centerHeight - baseHeight / 2)
        .attr("width", endBarWidth / 4)
        .attr("height", baseHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
            .attr("fill", "url(#leftBarGradient)");

    // Right end bar
    svg.append("rect")
        .attr("x", startPoint[0] + width)
        .attr("y", centerHeight - endBarHeight/2)
        .attr("width", endBarWidth)
        .attr("height", endBarHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
        .attr("fill", "url(#rightBarGradient)");

    svg.append("rect")
        .attr("x", startPoint[0] + width + endBarWidth)
        .attr("y", centerHeight - baseHeight/2)
        .attr("width", endBarWidth / 4)
        .attr("height", baseHeight)
        .attr("rx", rectRadius)
        .attr("ry", rectRadius)
        .attr("fill", "url(#rightBarGradient)");
}

function draw_context_bar(graph, context, width, dir='l') {
    let sorted_keys = Object.entries(context).sort((a, b) => b[1].total - a[1].total).map(entry => entry[0]);
    debugLog('context for', dir,  context);
    let totalSize = sorted_keys.reduce((acc, key) => acc + context[key].total, 0);
    let bbox = graph['bbox'];
    let g = graph['g'];

    const squareSize = 50; // 正方形大小
    let processedData = [];
    let margin = 5; // 方块之间的间隔
    const xPositions = {};
    sorted_keys.forEach(topicID => {
        Object.keys(context[topicID]).forEach(year => {
            if (year === 'total') return;
            if (!xPositions[year]) xPositions[year] = (dir == 'l'? bbox.x - bbox_padding_x: bbox.x + bbox.width + bbox_padding_x);
            
            let nodeCount = 0;
            context[topicID][year].forEach((edge, index) => {
                let nodeID = dir == 'l'? edge.source: edge.target;
                let leftX = dir == 'l'? xPositions[year] - squareSize * (index + 1) - margin * nodeCount: 
                                        xPositions[year] + squareSize * index + margin * nodeCount;
                if (processedData.length > 0 && processedData[processedData.length - 1].id == nodeID) {
                    processedData[processedData.length - 1].edge.push(edge);
                    if (dir == 'l') processedData[processedData.length - 1].x = leftX + margin;
                } else {
                    nodeCount += 1;
                    processedData.push({
                        id: nodeID,
                        node: findNodeById(nodeID),
                        topic: topicID,
                        year: year,
                        y: graph['id2attr']['l' + year].y - squareSize / 2,
                        x: leftX,
                        edge: [edge]
                    });
                }
            });
            
            let tmp = xPositions[year];
            if (dir == 'l') xPositions[year] -= squareSize * context[topicID][year].length + margin * nodeCount;
            else xPositions[year] += squareSize * context[topicID][year].length + margin * nodeCount;
            context[topicID][year].m = Math.min(xPositions[year], tmp);
            context[topicID][year].M = Math.max(xPositions[year], tmp);
        });
    });

    debugLog('processedData', processedData);

    // 创建多边形路径数据
    let topicPaths = {};
    let startX = (dir == 'l'? bbox.x - bbox_padding_x: bbox.x + bbox.width + bbox_padding_x);
    sorted_keys.forEach(topicID => {
        if (!topicPaths[topicID]) {
            topicPaths[topicID] = [];
        }

        // 添加顶部方块
        let tmp = startX + (dir == 'l'? - 1: 1) * context[topicID].total / totalSize  * width;
        // let tmp = startX + (dir == 'l'? - 1: 1) * context[topicID].total  * squareSize / 4;
        let m = Math.min(startX, tmp);
        let M = Math.max(startX, tmp);
        startX = tmp;

        topicPaths[topicID].m = m;
        topicPaths[topicID].M = M;
        if (dir == 'l') {
            topicPaths[topicID].r = (bbox.x - bbox_padding_x) - M;
            topicPaths[topicID].R = (bbox.x - bbox_padding_x) - m;
        } else {
            topicPaths[topicID].r = m - (bbox.x + bbox.width + bbox_padding_x);
            topicPaths[topicID].R = M - (bbox.x + bbox.width + bbox_padding_x);
        }

        let y = bbox.y - bbox_padding_y;
        topicPaths[topicID].push([M, y]); 
        topicPaths[topicID].unshift([m, y]); 

        Object.keys(context[topicID]).forEach(year => {
            if (year === 'total') return true;
            // 先添加右侧点
            topicPaths[topicID].push([context[topicID][year].M, graph['id2attr']['l' + year].y - squareSize /2]); // 右上
            topicPaths[topicID].push([context[topicID][year].M, graph['id2attr']['l' + year].y + squareSize /2]); // 右下
            
            // 然后添加左侧点
            topicPaths[topicID].unshift([context[topicID][year].m, graph['id2attr']['l' + year].y - squareSize /2]); // 左上
            topicPaths[topicID].unshift([context[topicID][year].m, graph['id2attr']['l' + year].y + squareSize /2]); // 左下
            
        })
    });

    debugLog('topicPaths', topicPaths);

    let center = dir == 'l'? [bbox.x - bbox_padding_x, bbox.y - bbox_padding_y]
                            : [bbox.x + bbox.width + bbox_padding_x, bbox.y - bbox_padding_y];
    let suffix = dir=='l'? 'o': 'i';
    let resuffix  = dir=='l'? 'i': 'o';

    const arcGenerator = d3.arc()
        .innerRadius(d => d.r)
        .outerRadius(d => d.R)  // 控制厚度，使其看起来像一个填充的椭圆
        .startAngle(-Math.PI / 2)  // 开始角度
        .endAngle(Math.PI / 2)    // 结束角度
        .cornerRadius(0);

    // 绘制多边形
    Object.keys(topicPaths).forEach(topicID => {
        g.append("path")
           .datum(topicPaths[topicID])
           .attr("fill", sliceColor(topicID))
           .attr("fill-opacity", topicOpacity)
           .attr("class", "context-polygon context-polygon_" + topicID)
        //    .attr("stroke", sliceColor(topicID))
        //    .attr("stroke-width", 2)
           .attr("d", d3.line()
                        .x(d => d[0])
                        .y(d => d[1])
                        .curve(d3.curveLinearClosed))
            .on('mouseover', function() {
                let field = getTopic(topicID);
                highlightSlice(topicID);
                tip.show({name: field.name + '\n' + context[topicID].total});
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', resetSliceHighlight);

        let field = getTopic(topicID);
        
        g.append("path")
              .datum(topicPaths[topicID])
              .attr("fill", sliceColor(topicID))
              .attr("fill-opacity", topicOpacity)
              .attr("class", "context-ellipse context-ellipse_" + topicID)
              .attr("d", d=> arcGenerator(d))
              .attr("transform", `translate(${center[0]}, ${center[1]})  scale(1, 0.5)`)
              .on('mouseover', function() {
                highlightSlice(topicID);
                tip.show({name: field.name + ':\n' + context[topicID].total});
                d3.select(this).attr('cursor', 'pointer');
            })
            .on('mouseout', resetSliceHighlight);
            
        let y = (topicPaths[topicID].r + topicPaths[topicID].R) / 4;
        g.append("text")
            .attr("x", center[0])
            .attr("y", center[1] - y)
            .attr("text-anchor", "middle")
            // 垂直居中
            .attr("dominant-baseline", "middle")
            .attr("font-family", "Archivo Narrow")
            .attr("font-size", Math.sqrt(context[topicID].total) * 20)
            .attr("class", "context-text context-text_" + topicID)
            // 逆时针旋转45度
            // .attr("transform", `rotate(-45, ${x}, ${center[1]})`)
            .text(getSliceLabelText(field, "chord"))
            .attr("pointer-events", "none");
    });

    const activeSliceId = getSelectedSliceId();

    g.append("rect")
        .attr("x", dir =='l'? center[0]: center[0] - width)
        .attr("y", center[1])
        .attr("width", width)
        .attr("height", squareSize)
        .attr("fill", sliceColor(activeSliceId))
        .attr("fill-opacity", topicOpacity)
        .attr("class", "context-polygon context-polygon_" + activeSliceId)
        .on('mouseover', function() {
            highlightSlice(activeSliceId);
            tip.show({name: (dir=='l'? 'Influx': 'Efflux') + ':\n' + totalSize});
            d3.select(this).attr('cursor', 'pointer');
        })
        .on('mouseout', resetSliceHighlight);

    g.append("text")
        .attr("x", dir == 'l'? center[0] + width / 2: center[0] - width / 2)
        .attr("y", center[1] + squareSize/2)
        .attr("text-anchor", "middle")
        .attr("dominant-baseline", "middle")
        .attr("font-family", "Archivo Narrow")
        .attr("font-size", Math.sqrt(totalSize) * 10)
        .attr("class", "context-text context-text_" + activeSliceId)
        .text(dir=='l'? 'Influx': 'Efflux') // dir=='l'? STopic + '→': '→' + STopic
        .attr("pointer-events", "none");

    // 绘制方块
    g.selectAll("rect_" + dir)
       .data(processedData)
       .enter()
       .append("rect")
       .attr("x", d => d.x)
       .attr("y", d => d.y)
       .attr("width", d => squareSize * d.edge.length)
       .attr("height", squareSize)
       .attr('id', d => d.id)
       .attr('class', "rect_" + dir)
       .attr("fill", d => sliceColor(d.topic))
       .on("mouseover", function(d) {  
            // 使用 function 关键字而不是箭头函数
            d3.select(this)
            .attr("cursor", "pointer")
            .style("stroke", "red")
            .style("stroke-width", 2);
            tip.show(d.node);
       })
        .on("mouseout", function(d) {
            d3.select(this)
            .attr("cursor", "default")
            .style("stroke", "none");

            tip.hide(d.node);
        })
        .on("click", d => {
            highlight_node(d.id);
        })
}

function distance(p1, p2) {
    return Math.sqrt((p1[0] - p2[0]) ** 2 + (p1[1] - p2[1]) ** 2);
}

function parsePathNumbers(pathD) {
    const matches = String(pathD || "").match(/-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
    return matches ? matches.map(Number) : [];
}

function isValidSvgPathD(pathD) {
    if (typeof pathD !== "string" || pathD.trim() === "") return false;
    if (/nan|undefined|null/i.test(pathD)) return false;
    const numbers = parsePathNumbers(pathD);
    return numbers.length >= 8 && numbers.every(Number.isFinite);
}

function isValidPathObject(path) {
    return path && isValidSvgPathD(path.d) && Number.isFinite(Number(path.width || 1));
}

function parseBezierCurveSafe(curveStr, reverse = false) {
    if (!isValidSvgPathD(curveStr)) return null;
    const points = parsePathNumbers(curveStr);
    if (points.length < 8) return null;
    const offset = reverse ? points.length - 8 : 0;
    return [
        {x: points[offset], y: points[offset + 1]},
        {x: points[offset + 2], y: points[offset + 3]},
        {x: points[offset + 4], y: points[offset + 5]},
        {x: points[offset + 6], y: points[offset + 7]}
    ];
}

function safeNormalize(vector) {
    if (!vector || !Number.isFinite(vector.x) || !Number.isFinite(vector.y)) return null;
    const length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    if (!Number.isFinite(length) || length < 1e-6) return null;
    return {x: vector.x / length, y: vector.y / length};
}

function sanitizeContextPaths(context, id2attr) {
    Object.keys(context || {}).forEach(edge => {
        if (!id2attr[edge] || !Array.isArray(id2attr[edge].path)) {
            delete context[edge];
            delete id2attr[edge];
            return;
        }

        id2attr[edge].path = id2attr[edge].path.filter(isValidPathObject);
        if (id2attr[edge].path.length === 0) {
            delete context[edge];
            delete id2attr[edge];
        }
    });
}

function getStartPoints(key, id2attr) {
    // 如果有多个路径，确保第一个和第二个路径首位相接：修改第一个路径的终止点，使其与第二个路径的起始点相接
    let startPoint = [];
    if (!id2attr[key] || !Array.isArray(id2attr[key].path)) return startPoint;
    id2attr[key].path = id2attr[key].path.filter(isValidPathObject);
    id2attr[key].path.forEach(function(path) {
        startPoint.push(path.d.split('C')[0].split('M')[1]);  
        // 起始节点字符串，如：67.03,-810
    })
    if (startPoint.length > 1) {
        for (let i = 1; i < startPoint.length; i++) {
            let p1 = id2attr[key].path[i - 1].d.split(' ').pop();
            let p2 = startPoint[i];
            let d = distance(p1.split(','), p2.split(','));
            if (d > 10) {
                debugLog('Context edge path is not connected; keep original path.', d, p1, p2);
                continue;
            }
            id2attr[key].path[i - 1].d = id2attr[key].path[i - 1].d.replace(p1, p2);
        }
    }
    return startPoint;
}

function startPointAdjustment(contextEdges, id2attr) {
    if (contextEdges.length <= 1) return;
    // console.log('startPointAdjustment', contextEdges)

    let point2key = {}  // 起始节点字符串到 (context edge key, index) 的反向映射
    let pointTree = {}  // 起始节点的层次树，指向父节点

    contextEdges.forEach(function(key) {
        let lastPoint = null;
        getStartPoints(key, id2attr).forEach(function(p, i) {
            if (point2key[p] == null) point2key[p] = [];
            if (pointTree[p] == null) pointTree[p] = lastPoint;
            point2key[p].push([key, i]);
            lastPoint = p;
        })
    })

    // 拓扑搜索，找到从下到上（pointTree指向）遍历的顺序
    let order = [];
    let allPoints = new Set(Object.keys(pointTree));
    let visited = new Set();
    function dfs(node) {
        if (visited.has(node)) return;
        visited.add(node);
        if (pointTree[node] != null) dfs(pointTree[node]);
        order.push(node);
    }
    for (let p of allPoints) dfs(p);
    order.reverse();
    debugLog('[startPointAdjustment]', contextEdges, pointTree, point2key, order);

    // layout adjustment
    order.forEach(function(p) {
        let keys = point2key[p];
        let totalWidth = keys.map(([key, i]) => id2attr[key].path[i].width).reduce((acc, val) => acc + val, 0);
        let baseKey = keys.filter(([key, i]) => i != 0);
        if (baseKey.length == 0) baseKey = keys[0];
        else {
            // 更新baseKey的前驱路径的宽度
            baseKey = baseKey[0];
            id2attr[baseKey[0]].path[baseKey[1] - 1].width = totalWidth;
        }
        // 更新宽度之后再判断
        if (keys.length <= 1) return;   
        let basePath = id2attr[baseKey[0]].path[baseKey[1]].d;
        let basePoints = parseBezierCurveSafe(basePath);
        if (!basePoints) return;
        let [p0, p1, p2, p3] = basePoints;
        let tangent = bezierTangent(p0, p1, p2, p3, 0);
        let normalizedTangent = safeNormalize(tangent);
        if (!normalizedTangent) return;
        let baseNormal = perpendicular(normalizedTangent);

        // console.log('point', p, keys, baseNormal, totalWidth)


        let pointX = parseFloat(p.split(',')[0]), pointY = parseFloat(p.split(',')[1]);
        // point -= baseNormal * totalWidth / 2
        pointX -= baseNormal.x * totalWidth / 2;
        pointY -= baseNormal.y * totalWidth / 2;

        // 计算每条曲线的加权角度
        let angles = keys.map(([key, i]) => {
            const points = parseBezierCurveSafe(id2attr[key].path[i].d);
            if (!points) return null;
            let [p0, p1, p2, p3] = points;
            let angle1 = getAngleBetweenPoints(p0, p1);
            let angle2 = getAngleBetweenPoints(p0, p2);
            let angle3 = getAngleBetweenPoints(p0, p3);
            // 这里采用加权平均法来计算总的角度
            let totalAngle = angle1 * 0.5 + angle2 * 0.3 + angle3 * 0.2;
            return {key: [key, i], angle: totalAngle};
        }).filter(Boolean);

        // console.log('angles', angles);
        if (angles.length === 0) return;
        angles.sort((a, b) => a.angle - b.angle);

        angles.map(a => a.key).forEach(([key, i]) => {
            let w = id2attr[key].path[i].width;
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
            id2attr[key].path[i].d = id2attr[key].path[i].d.replace(p, `${pointX},${pointY}`);
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
        });
    });
}

function endPointAdjustment(contextEdges, id2attr) {
    if (contextEdges.length <= 1) return;
    // console.log('endPointAdjustment', contextEdges)

    point2key = {}
    contextEdges.forEach(function(key) {
        let paths = id2attr[key].path;
        let endPoint = paths[paths.length - 1].d.split(' ').pop();
        Object.keys(point2key).forEach(function(p) {
            let d = distance(p.split(','), endPoint.split(','));
            if (d < 10) {
                paths[paths.length - 1].d = paths[paths.length - 1].d.replace(endPoint, p);
                endPoint = p;
            }
        })
        if (point2key[endPoint] == null) point2key[endPoint] = [];
        point2key[endPoint].push(key);
    })
    // console.log(point2key)

    // layout adjustment
    Object.keys(point2key).forEach(function(p) {
        let keys = point2key[p];
        if (keys.length <= 1) return;
        let totalWidth = keys.map(key => id2attr[key].path[id2attr[key].path.length - 1].width).reduce((acc, val) => acc + val, 0);
        let baseNormal = {x: 0, y: -1};

        // console.log('point', p, keys, baseNormal, totalWidth)
        let pointX = parseFloat(p.split(',')[0]), pointY = parseFloat(p.split(',')[1]);
        // point -= baseNormal * totalWidth / 2
        pointX -= baseNormal.x * totalWidth / 2;
        pointY -= baseNormal.y * totalWidth / 2;

        // 计算每条曲线的加权角度
        let angles = keys.map(key => {
            let path = id2attr[key].path;
            // 注意这里是最后4个！！！！
            const points = parseBezierCurveSafe(path[path.length - 1].d, true);
            if (!points) return null;
            let [p0, p1, p2, p3] = points;
            let angle1 = getAngleBetweenPoints(p3, p2);
            let angle2 = getAngleBetweenPoints(p3, p1);
            let angle3 = getAngleBetweenPoints(p3, p0); // 注意第端点应该在前面
            // 这里采用加权平均法来计算总的角度
            let totalAngle = angle1 * 0.5 + angle2 * 0.3 + angle3 * 0.2;
            return {key: key, angle: totalAngle, angle1: angle1, angle2: angle2, angle3: angle3, points: [p0, p1, p2, p3]};
        }).filter(Boolean);

        // console.log('angles', angles);
        if (angles.length === 0) return;
        angles.sort((a, b) => a.angle - b.angle);

        angles.map(a => a.key).forEach(key => {
            let path = id2attr[key].path;
            let w = path[path.length - 1].width;
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
            path[path.length - 1].d = path[path.length - 1].d.replace(p, `${pointX},${pointY}`);
            pointX += baseNormal.x * w / 2;
            pointY += baseNormal.y * w / 2;
        });
    });
}

function searchBundling(context, id2attr) {
    // start point adjustment
    let year2context = {}, node2context = {};  // 从左边年份/中心节点出发的context边
    Object.keys(context).forEach(function(key) {
        if (key[0] == 'l') {
            let year = key.split('->')[0];
            if (year2context[year] == null) year2context[year] = [];
            year2context[year].push(key);
        } else {
            let node = key.split('->')[0];
            if (node2context[node] == null) node2context[node] = [];
            node2context[node].push(key);
        }
    })

    Object.keys(year2context).forEach(function(year) {
        startPointAdjustment(year2context[year], id2attr);
    })
    Object.keys(node2context).forEach(function(node) {
        startPointAdjustment(node2context[node], id2attr);
    })


    // end point adjustment
    year2context = {}, node2context = {};  // 到达右边年份/中心节点的context边
    Object.keys(context).forEach(function(key) {
        if (key[0] == 'l') {
            let node = key.split('->')[1];
            if (node2context[node] == null) node2context[node] = [];
            node2context[node].push(key);
        } else {
            let year = key.split('->')[1];
            if (year2context[year] == null) year2context[year] = [];
            year2context[year].push(key);
        }
    })
    // 只调节目标为年份的context边，确定normal为y方向
    Object.keys(year2context).forEach(function(year) {
        endPointAdjustment(year2context[year], id2attr);
    })
    // Object.keys(node2context).forEach(function(node) {
    //     endPointAdjustment(graph, node2context[node]);
    // })
}

function getAngle(tangent) {
    return Math.atan2(tangent.y, tangent.x);
}

function getAngleBetweenPoints(p1, p2) {
    ret = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return ret < 0? ret + Math.PI * 2: ret;
}

function bezierTangent(p0, p1, p2, p3, t = 0) {
    let x = 3 * (1 - t) * (1 - t) * (p1.x - p0.x) +
            6 * (1 - t) * t * (p2.x - p1.x) +
            3 * t * t * (p3.x - p2.x);
    
    let y = 3 * (1 - t) * (1 - t) * (p1.y - p0.y) +
            6 * (1 - t) * t * (p2.y - p1.y) +
            3 * t * t * (p3.y - p2.y);
    
    return {x: x, y: y};
}

function normalize(vector) {
    let length = Math.sqrt(vector.x * vector.x + vector.y * vector.y);
    return {x: vector.x / length, y: vector.y / length};
}

function perpendicular(vector) {
    return {x: -vector.y, y: vector.x};
}

function parseBezierCurve(curveStr) {
    let points = curveStr.match(/[-]?\d*\.\d+|\d+/g).map(Number);
    return [
        {x: points[0], y: points[1]},  // 起点
        {x: points[2], y: points[3]},  // 控制点1
        {x: points[4], y: points[5]},  // 控制点2
        {x: points[6], y: points[7]}   // 终点
    ];
}

function parseBezierCurveReverse(curveStr) {
    // 返回最后4个点
    let points = curveStr.match(/[-]?\d*\.\d+|\d+/g).map(Number);
    let l = points.length;
    return [
        {x: points[l - 8], y: points[l - 7]},  // 起点
        {x: points[l - 6], y: points[l - 5]},  // 控制点1
        {x: points[l - 4], y: points[l - 3]},  // 控制点2
        {x: points[l - 2], y: points[l - 1]}   // 终点
    ];
}

function isContextEdgeDirection(edgeKey, dir=null) {
    if (dir == null || dir === 'm') return true;
    const normalizedDir = String(dir);
    const key = String(edgeKey);
    if (normalizedDir === 'l') return key[0] === 'l';
    if (normalizedDir === 'r') return key[0] !== 'l';
    return true;
}

function getContextTopicWeight(value, topicId) {
    const topics = value?.topics || {};
    const topicKey = Object.keys(topics).find(key => String(key) === String(topicId));
    return topicKey == null ? null : topics[topicKey];
}

function getActiveScrollGraph() {
    const activeSliceId = getSelectedSliceId();
    if (graph && String(graph.sliceId) === String(activeSliceId) && graph['combinedContextEdges']) {
        return graph;
    }
    return activeSliceId == null ? null : getActiveSliceGraph(activeSliceId);
}

function getStreamContextEdgeSignatures(streamTopicContext) {
    const signatures = new Set();
    if (!streamTopicContext) return signatures;

    Object.entries(streamTopicContext).forEach(([year, edges]) => {
        if (year === 'total' || !Array.isArray(edges)) return;
        edges.forEach(edge => {
            if (edge?.source == null || edge?.target == null) return;
            signatures.add(`${String(edge.source)}->${String(edge.target)}`);
        });
    });

    return signatures;
}

function getContextEdgesForSlice(graph, sliceId, dir=null, streamSliceContext=null) {
    const selectedContext = {};
    if (!graph || !graph['combinedContextEdges']) return selectedContext;

    const streamEdgeSignatures = getStreamContextEdgeSignatures(streamSliceContext);
    Object.entries(graph['combinedContextEdges']).forEach(([key, value]) => {
        if (!isContextEdgeDirection(key, dir)) return;

        const matchedByTopic = getContextTopicWeight(value, sliceId) != null;
        const matchedByStream = streamEdgeSignatures.size > 0 && (value.edges || []).some(edge => {
            if (edge?.source == null || edge?.target == null) return false;
            return streamEdgeSignatures.has(`${String(edge.source)}->${String(edge.target)}`);
        });

        if (matchedByTopic || matchedByStream) {
            selectedContext[key] = JSON.parse(JSON.stringify(value));
        }
    });

    return selectedContext;
}

function drawContextEdgesBySlice(graph, sliceId, dir=null, streamSliceContext=null) {
    // 绘制与指定 slice 相关的 context 边
    debugLog('[drawContextEdgesBySlice]', sliceId, dir)
    context = getContextEdgesForSlice(graph, sliceId, dir, streamSliceContext);
    drawContextEdges(graph, context, 'egroup-context-slice');
}

function drawContextEdges(graph, context=null, classname='egroup-context') {
    if (context == null) context = graph['combinedContextEdges'];
    debugLog('[drawContextEdges]', classname, context);
    const isSliceContext = classname.includes('egroup-context-slice');
    let color = (isSliceContext ? streamContextEdgeColor : contextEdgeColor);

    // draw context graph['edges']:
    // - edge id in Object.keys(graph['contextEdges'])
    // - using graph['id2attr'][edge]  to get the Path
    // - using graph['contextEdges'][edge].length to get width
    // - using all graph['edges'] in graph['contextEdges'][edge], find the target and use topic of target to get color

    // make flowmap based on edge bundling
    id2attr = {}    // 保存一个新的id2attr，不改变原来的id2attr
    Object.keys(context).forEach(function(edge) {
        if (!Object.keys(graph['id2attr']).includes(edge)) {
            debugLog('[drawContextEdges] context edge not found, maybe flat-edges, removing edge from context', edge, graph['id2attr'][edge], context[edge])
            delete context[edge];
            return true;    // continue
        } else {
            id2attr[edge] = JSON.parse(JSON.stringify(graph['id2attr'][edge]));
        }
        let obj = context[edge];
        id2attr[edge].path = (id2attr[edge].path || []).filter(isValidPathObject);
        if (id2attr[edge].path.length === 0) {
            delete context[edge];
            delete id2attr[edge];
            return true;
        }
        id2attr[edge].path.forEach(d=>{
            d.width = obj.weight  * contextEdgeWeight;
            d.color = color;
        })
    })
    sanitizeContextPaths(context, id2attr);
    searchBundling(context, id2attr);
    sanitizeContextPaths(context, id2attr);


    const classSelector = '.' + String(classname).trim().split(/\s+/)[0];
    const edgeGroups = graph['g'].selectAll(classSelector)
        .data(Object.keys(context)) // 使用edges数组，每个元素代表一条边
        .enter()
        .append('g')
        .attr('class', classname)
        .style('pointer-events', isSliceContext ? 'none' : null);

    // 在每个group中为每条边添加path元素
    edgeGroups.each(function(edge) {
        // if (!Object.keys(id2attr).includes(edge)) return true;
        const edgeGroup = d3.select(this);

        // console.log(edgeGroup, id2attr[edge].path)
        let paths = (id2attr[edge]?.path || []).filter(isValidPathObject);
        if (paths.length === 0) return true;
        edgeGroup.selectAll('.epath')
            .data(paths)
            .enter()
            .append('path')
            .attr('d', d=>d.d)
            .style("fill", 'none')
            .style("stroke", d=>d.color)
            .style('stroke-opacity', isSliceContext ? streamContextEdgeOpacity : 0.5)
            .style('stroke-width', d=>isSliceContext ? Math.max(d.width, 4) : d.width)
            .style('pointer-events', isSliceContext ? 'none' : null)
            .attr('class', 'epath')
            .attr('id', selectorById(edge))
            .on('mouseover', function () {
                mouseoverEdge(edge, width=null);
                tip.show({name: edge});
            })
            .on('click', function () {
                // if (context[edge].weight == 1) {
                let e = context[edge].edges[0];
                highlight_edge(`${e.source}->${e.target}`);
                // }
                clickEdge(edge, width=null);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge);
                tip.hide(edge);
            });

        if (edge[0] != 'l') return true; 

        // Add arrowhead to the last path
        let lastPath = paths[paths.length - 1];
        let arrowhead = calculateArrowheadParams(lastPath.d);
        if (!arrowhead) return true;
        let { endPoint, tangentVector } = arrowhead;
        let normalVector = perpendicular(tangentVector);
        let arrowLength = 20;
        let arrowWidth = lastPath.width;
        let arrowPoints = [
            { x: endPoint.x + arrowLength * tangentVector.x, y: endPoint.y + arrowLength * tangentVector.y},
            { x: endPoint.x + arrowWidth / 2 * normalVector.x, y: endPoint.y + arrowWidth / 2 * normalVector.y },
            { x: endPoint.x - arrowWidth / 2 * normalVector.x, y: endPoint.y - arrowWidth / 2 * normalVector.y }
        ];

        edgeGroup.append('polygon')
            // .attr('class', 'epath-polygon')
            // .attr('id', selectorById(edge) + '_polygon')
            .attr('points', arrowPoints.map(p => `${p.x},${p.y}`).join(' '))
            .style('fill', color)
            .style('fill-opacity', 0.5)
            .style('pointer-events', isSliceContext ? 'none' : null);
    });

    if (isSliceContext) {
        graph['g'].selectAll('.egroup-context-slice').raise();
    }
}   

function calculateArrowheadParams(d) {
    if (!isValidSvgPathD(d)) return null;
    let path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    let pathLength;
    try {
        pathLength = path.getTotalLength();
    } catch (error) {
        debugLog('Invalid context edge path skipped:', d, error);
        return null;
    }
    if (!Number.isFinite(pathLength) || pathLength <= 1) return null;
    let endPoint = path.getPointAtLength(pathLength);
    let tangentPoint = path.getPointAtLength(pathLength - 1);
    let tangentVector = {
        x: endPoint.x - tangentPoint.x,
        y: endPoint.y - tangentPoint.y
    };
    tangentVector = safeNormalize(tangentVector);
    if (!tangentVector) return null;
    return { endPoint, tangentVector };
}

function draw_bbox(graph) {
    let g = graph['g'];
    let bbox = g.node().getBBox();
    graph['bbox'] = bbox;

    const defs = g.append('defs');
    const filter = defs.append('filter')
        .attr('id', 'drop-shadow')
        .attr('x', '-20%')
        .attr('y', '-20%')
        .attr('width', '140%') // 增大过滤器的尺寸以包含阴影
        .attr('height', '140%');

    filter.append('feGaussianBlur')
        .attr('in', 'SourceAlpha')
        .attr('stdDeviation', 10) // 增大模糊半径
        .attr('result', 'blur');

    filter.append('feOffset')
        .attr('in', 'blur')
        .attr('dx', 0) // 减少水平偏移
        .attr('dy', 0) // 减少垂直偏移
        .attr('result', 'offsetBlur');

    // 使用feFlood创建阴影颜色
    const feFlood = filter.append('feFlood')
        .attr('flood-color', 'black')
        .attr('flood-opacity', 0.5)
        .attr('result', 'color');

    // 使用feComposite将阴影颜色与模糊效果合并
    filter.append('feComposite')
        .attr('in', 'color')
        .attr('in2', 'offsetBlur')
        .attr('operator', 'in')
        .attr('result', 'shadow');

    // 使用feMerge将原图形与阴影效果合并显示
    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode')
        .attr('in', 'shadow');
    feMerge.append('feMergeNode')
        .attr('in', 'SourceGraphic');

    // 绘制g元素的外框
    g.insert('rect', ':first-child')
        .attr('x', bbox.x - bbox_padding_x)
        .attr('y', bbox.y - bbox_padding_y)
        .attr('width', bbox.width + bbox_padding_x * 2)
        .attr('height', bbox.height + bbox_padding_y * 2)
        .style("fill", 'white')
        .style("stroke", sliceColor(graph['sliceId'], 1))
        .style("stroke-width", 5)
        .attr('filter', 'url(#drop-shadow)')
        .attr('id', 'background');

    // 在外框顶部中心添加标题
    let topic = findActiveSlice(graph['sliceId']) || {shortName: "", name: ""};
    const topicLabel = splitSliceShortName(topic.shortName || topic.name);
    const titleLines = topicLabel.filter(line => String(line || "").trim() !== "");
    const lineCount = Math.max(1, titleLines.length);
    let sqrtSize = Math.sqrt(bbox.width * bbox.height);
    let titleTop = bbox.y - bbox_padding_y + 6;
    let titleBottom = bbox.y - 10;
    let titleAvailableHeight = Math.max(titleBottom - titleTop, 24);
    let titleLineHeight = lineCount === 1 ? 1 : 1.08;
    let titleFontSize = Math.min(
        sqrtSize * 0.085,
        titleAvailableHeight / (lineCount * titleLineHeight)
    );
    titleFontSize = Math.max(titleFontSize, lineCount === 1 ? 24 : 18);
    titleFontSize *= 4;
    let titleY = titleTop + Math.max((titleAvailableHeight - titleFontSize * lineCount * titleLineHeight) / 2, 0);
    textElement = g.append('text')
        .attr('x', bbox.x + bbox.width / 2)
        .attr('y', titleY)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'hanging')
        .style('font-family', `"Archivo Narrow", "Noto Sans SC", "Microsoft YaHei", sans-serif`)
        .style('font-size', titleFontSize + 'px')
        .style('font-weight', 400)
        // .text(topicData.shortName)
        .attr('id', 'title')
        // .style('stroke', 'white')
        // .style('stroke-width', 1)
        .on('click', function() {
            // hide text
            d3.select(this).style('display', 'none');
        });

    textElement.append("tspan")
        .attr('x', bbox.x + bbox.width / 2)
        .attr("dy", "0em")
        .text(topicLabel[0]);
    if (topicLabel[1]) {
        textElement.append("tspan")
            .attr('x', bbox.x + bbox.width / 2)
            .attr("dy", "1.08em")
            .text(topicLabel[1]);
    }
}

function generateD3Path(points, curve = false) {
    // 使用D3的线条生成器，根据curve参数决定是否使用curveBasis
    const lineGenerator = d3.line();
    if (curve) {
        lineGenerator.curve(d3.curveBasis);
    }

    const pathData = lineGenerator(points);
    return pathData;
}

function convertToPointsArray(pathString) {
    // 从路径字符串中提取坐标点
    const points = pathString.split(' ')
        .slice(1) // 去除路径字符串开头的 "e," 或其他字符
        .map(pair => {
            const cleanedPair = pair.trim().replace(/ +/g, ',');
            const coords = cleanedPair.split(',');
            if (coords.length === 2 && !isNaN(parseFloat(coords[0])) && !isNaN(parseFloat(coords[1]))) {
                return [parseFloat(coords[0]), -parseFloat(coords[1])]; // 注意：转换y坐标为负值以适应SVG坐标系统
            }
            return null;
        })
        .filter(p => p !== null); // 过滤掉任何无效坐标点

    return points;
}




function transformNodeName(name) {
    // 根据yearGrid调整节点名称
    let match = /^([lr])(\d+)$/.exec(name);
    if (match) {
        let prefix = match[1];
        let number = parseInt(match[2]);
        if (prefix === 'l') {
            return `l${Math.max((Math.floor(number / yearGrid) * yearGrid), minYear)}`;
        } else if (prefix === 'r') {
            return `r${Math.min(((Math.floor(number / yearGrid) + 1) * yearGrid) - 1, maxYear)}`;
        }
    }
    return name;
}

function transfromEdgeName(name) {
    // 根据yearGrid调整边名称
    let [src, dst] = name.split('->');
    return `${transformNodeName(src)}->${transformNodeName(dst)}`;
}

function getEdgeBundlingStr() {
    return edgeBundling == 6? '': 
    `concentrate=true
concentrate_type=${edgeBundling}`;
}
function bindSVGToElement(graph, key, elementId) {
    let svgElement = graph[key];
    let {svg: svg, g: g} = bindSVG(svgElement, elementId);

    graph[key] = svg; // 更新 svgElement 为新的 SVG 元素
    if (key === 'svg') graph['g'] = g;
}

function adjustViewBox(originalViewBox, scaleFactor = 1.3) {
    try {
        // 解析 viewBox 属性
        let viewBoxValues = originalViewBox.split(' ').map(Number);
        let viewBoxX = viewBoxValues[0];
        let viewBoxY = viewBoxValues[1];
        let viewBoxWidth = viewBoxValues[2];
        let viewBoxHeight = viewBoxValues[3];

        // 增加 viewBox 的宽度和高度，使内容显示缩小
        let newViewBoxWidth = viewBoxWidth * scaleFactor;
        let newViewBoxHeight = viewBoxHeight * scaleFactor;

        // 调整 viewBox 的 x 和 y，使内容居中
        let newViewBoxX = viewBoxX - (newViewBoxWidth - viewBoxWidth) / 2;
        let newViewBoxY = viewBoxY - (newViewBoxHeight - viewBoxHeight) / 2;

        // 重新设置 viewBox 属性
        let newViewBox = `${newViewBoxX} ${newViewBoxY} ${newViewBoxWidth} ${newViewBoxHeight}`;
        
        return newViewBox;
    } catch (error) {
        console.error("Error adjusting viewBox:", error);
        return originalViewBox;
    }
}


function bindSVG(svgElement, elementId) {
    let ele = d3.select(elementId).node();
    d3.select(elementId).selectAll("*").remove();

    let wasHidden = $(ele).is(':hidden');
    if (wasHidden) $(ele).show();

    let svgWidth = ele.getBoundingClientRect().width || $(elementId).width();
    let svgHeight = ele.getBoundingClientRect().height || $(elementId).height();

    const svg = d3.select(elementId).append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .attr("overflow", "hidden");

    let g = svg.append("g");

    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        g.node().appendChild(this);
    });

    let svgbbox = svgElement.getBBox();
    let svgViewBox = svgElement.getAttribute("viewBox");
    let x, y, width, height;
    let lis = svgViewBox.split(' ').map(Number);
    x = lis[0];
    y = lis[1];
    width = lis[2];
    height = lis[3];
    debugLog('[bindSVG] svgbbox', svgbbox, svgViewBox, y);

    // 确保元素可见后计算包围盒
    // let rect = g.node().getBoundingClientRect();
    // let bbox = { x: rect.left, y: rect.top, width: rect.width, height: rect.height };
    let bbox = g.node().getBBox();
    let viewBox = `${bbox.x} ${bbox.y} ${bbox.width} ${bbox.height}`;
    debugLog('[bindSVG] bbox', bbox, viewBox, bbox.y);

    // 超级难受的硬编码
    svg.attr("viewBox", 
        elementId == getContainerSelector("scrollPanel") && getSelectedSliceId() ? adjustViewBox(viewBox, 1.45) : viewBox)
       .attr("preserveAspectRatio", "xMidYMid meet"); // 确保内容居中并等比缩放

    // 添加缩放和拖拽功能
    const zoom = d3.zoom()
        .scaleExtent([0.01, 100])
        .wheelDelta(() => -d3.event.deltaY * 0.001) 
        .on("zoom", () => {
            g.attr("transform", d3.event.transform);
        });

    svg.call(zoom);
    svg.on("click.stream-reset", function() {
        if (d3.event && d3.event.defaultPrevented) return;
        if (d3.event && d3.event.target === this) {
            cancelActiveStreamSelection();
        }
    });

    // 所有渲染完成后恢复原始隐藏状态
    if (wasHidden) $(ele).hide();

    return {svg, g};
}

function drawGeneticPrism() {
    let container = getContainerElement("prismContainer");
    // container.replaceWith(container.cloneNode(true));
    // container = document.getElementById('prism-container');

    let prism = getContainerElement("prism");
    if (!container || !prism) return;
    prism.innerHTML = ''; // 清空现有内容
    resetSliceAngleRanges();
    prismFaceElementBySliceId = {};
    activePrismFaceSliceId = null;
    // TODO: 清除 prism 所有的动画，脚本，事件

    let lastMouseX, lastMouseY;
    setFocusedSliceIndex(0);
    // prism.style.transform = `scale(${scale})`
    
    // container.style
    prismHeight = container.offsetHeight;
    const prismWidth = container.offsetWidth;
    let prismUpperMargin = 100;
    const style = window.getComputedStyle(container);
    let perspectiveDistance = parseFloat(style.perspective);
    stopRotateToAnimation(true);
    stopPrismRotationLoop();
    prism.style.transform = `scale(${prismScale}) rotateX(${rotationAngleX}deg)`;
    const activeSlices = getActiveSlices();
    const activeMatrix = getActiveSliceRelationMatrix();
    let slices = JSON.parse(JSON.stringify(activeSlices));

    // const totalSize = d3.sum(slices, d => d.size);
    let { rowSums: outdegree, colSums: indegree } = sumRowsAndColumns(activeMatrix);
    let weights = adjustWeight(outdegree);
    // let sizes = global_paper_field.map(d => d.size);
    // weights = adjustWeight(weights.map((d, ix) => Math.sqrt(d * sizes[ix])));
    const totalSize = d3.sum(weights);
    let currentAngle = 0;

    slices.forEach((slice, i) => {
        debugLog('prism slice', slice)
        // const sliceAngle = (slice.size / totalSize) * 360;
        const sliceAngle = (weights[i] / totalSize) * 360;
        const startAngle = currentAngle;
        currentAngle += sliceAngle / 2;
        // const theta = (slice.size / totalSize) * 2 * Math.PI;
        const theta = (weights[i] / totalSize) * 2 * Math.PI;
        
        const width = 2 * prismRadius * Math.sin(theta / 2);
        const distance = prismRadius * Math.cos(theta / 2);

        let svgWrapper = d3.select(getContainerSelector("prism")).append("div")
            .attr("id", `svg-wrapper-${slice.id}`)
            .attr("class", "svg-wrapper")
            .style("transform", `rotateY(${currentAngle}deg) translateZ(${distance}px) translateX(${prismWidth/2}px)`);

        // height 与 svg-wrapper 的高度一致
        // const height = svgWrapper._groups[0][0].offsetHeight;

        let graph = getActiveSliceGraph(slice.id);
        if (!graph) {
            loadSliceGraph(slice.id);
            graph = getActiveSliceGraph(slice.id);
        }
        if (!graph) return;
        graph['width'] = width / 72;    // 英寸转为pt
        graph['height'] = (prismHeight - prismUpperMargin) / 72;
        init_graph(graph, false);   // 不绘制context信息
        let svgElement = graph['svg'];
        debugLog(graph);

        const svg = svgWrapper.append("svg")
            .style("overflow", "visible")
            .attr('id', `svg-${slice.id}`)
            .style("cursor", "pointer")
            .on("click", function() {
                if (d3.event) d3.event.stopPropagation();
                if (prismInteractionState.suppressClick) {
                    if (d3.event) d3.event.preventDefault();
                    return;
                }
                selectPrismSlice(slice.id, {
                    rotate: false,
                    source: "prism",
                });
            });

        const faceRect = svg.append("rect")
            .attr("id", `prism-rect-${slice.id}`)
            .attr("class", "prism-slice-face")
            .attr("data-slice-id", slice.id)
            .attr("x", -width / 2)
            .attr("y", 0)
            .attr("width", width)
            .attr("height", prismHeight)
            .attr("fill", d3.hsv(sliceColor(graph.sliceId).h, 0.05, 1))
            // .attr("stroke", sliceColor(graph.sliceId, 1))
            .attr("fill-opacity", graph.sliceId == (getSelectedSliceId() || activeSlices[0]?.id)? highlightOpacity: backgroundOpacity)
            .attr("stroke", graph.sliceId == (getSelectedSliceId() || activeSlices[0]?.id)? sliceColor(graph.sliceId, 1): 'none')
        prismFaceElementBySliceId[String(slice.id)] = faceRect;

        let textElement = svg.append("text")
            .attr("x", 0)
            .attr("y", prismHeight / 15) // - (i % 2) * prismHeight / 30
            .attr("text-anchor", "middle")
            .attr("dominant-baseline", "middle")
            .style("font-family", "Archivo Narrow")
            .attr("font-size", Math.cbrt(width) * 5 + "px")
            .attr("fill", "black")
        
        const sliceLabel = splitSliceShortName(slice.shortName);
        textElement.append("tspan")
            .attr("x", 0)
            .attr("dy", "0em")
            .text(sliceLabel[0]);
        textElement.append("tspan")
            .attr("x", 0)
            .attr("dy", "1.2em")
            .text(sliceLabel[1]);


        // 创建一个新的嵌套 svg 元素并设置 viewBox 和 transform
        let nestedSvg = svg.append("svg")
            .attr("x", -width / 2)
            .attr("y", prismUpperMargin)
            .attr("width", width)
            .attr("height", prismHeight - prismUpperMargin)
            .attr("viewBox", graph['viewBox']) // 设置 viewBox
            .attr('id', `nestedSvg-${slice.id}`); // 设置 transform

        // 将 svgElement 的子元素移动到嵌套的 svg 元素中
        // d3.select(svgElement).selectAll('*').filter(function() {
        //     return this.parentNode === svgElement;
        // }).each(function() {
        //     nestedSvg.node().appendChild(this);
        // });
        
        // 好处是无法交互
        Array.from(svgElement.childNodes).forEach(node => {
            nestedSvg.node().appendChild(node.cloneNode(true));
        });

        currentAngle += sliceAngle / 2;
        const endAngle = currentAngle;
        addSliceAngleRange({ startAngle, endAngle });
    });

    // 绘制topview弦图
    let svgWrapper = d3.select(getContainerSelector("prism")).append("div")
        .attr("id", `svg-wrapper-chord`)
        .attr("class", "svg-wrapper")
        .style("transform", `rotateX(90deg) translateZ(${prismHeight/2}px) rotateZ(180deg) translate(${prismWidth/2}px, ${prismHeight/2}px)`);
    let svg = svgWrapper.append("svg")
        .style("overflow", "visible")
        .attr('id', `svg-chord`);

    let svgElement = init_chord(true, false);
    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        svg.node().appendChild(this);
    });

    // 底部加一个一样的边框
    svgWrapper = d3.select(getContainerSelector("prism")).append("div")
        .attr("id", `svg-wrapper-chord-bottom`)
        .attr("class", "svg-wrapper")
        .style("transform", `rotateX(90deg) translateZ(${-prismHeight/2}px) rotateZ(180deg) translate(${prismWidth/2}px, ${prismHeight/2}px)`);
    svg = svgWrapper.append("svg")
        .style("overflow", "visible")
        .attr('id', `svg-chord-bottom`);
    svgElement = init_chord(true, false, false);
    d3.select(svgElement).selectAll('*').filter(function() {
        return this.parentNode === svgElement;
    }).each(function() {
        svg.node().appendChild(this);
    });
    update_chord_element();
    // function rotate() {
    //     // 通过移除帧率限制，你可以让 requestAnimationFrame 在浏览器的自然刷新率下更好地同步，减少 dropped frames 和 partially presented frames 的问题。
    //     if (rotationSpeed>0) { // 控制旋转速度，每秒30帧  && elapsed > 1000 / 30
    //         rotationAngleY -= 0.04 * rotationSpeed;
    //         if (rotationAngleY <= 0) rotationAngleY += 360;
    //         prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`
    //         // prism.style.transform = `rotateY(${rotationAngleY}deg)`; 
    //         updateOpacity();
    //         requestAnimationFrame(rotate);
    //     }
    // }

    // 通过控制动画的更新频率来“模拟”不同的帧率。虽然不能直接改变刷新率，但你可以让你的动画以较低的帧率运行，从而适应不同的显示器刷新率。
    let lastTime = 0;
    const fps = 30;  // 想要的帧率

    function rotate(timestamp) {
        if (rotationSpeed==0) {
            prismAnimationFrame = requestAnimationFrame(rotate);
            return;
        }
        if (!lastTime) lastTime = timestamp;
        const elapsed = timestamp - lastTime;

        // 只在达到目标帧率时才更新
        if (elapsed > 1000 / fps) {
            lastTime = timestamp;
            // 更新动画逻辑
            rotationAngleY -= 0.1 * rotationSpeed;
            if (rotationAngleY <= 0) rotationAngleY += 360;
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
            updateOpacity();
        }

        prismAnimationFrame = requestAnimationFrame(rotate);
    }
    
    function startRotation() {
        chord_arcs.style("opacity", defaultOpacity / 3);
        chord_ribbons.style("opacity", defaultOpacity / 3);
        isRotating = true;
        stopPrismRotationLoop();
        prismAnimationFrame = requestAnimationFrame(rotate);
    }

    if (!container.dataset.prismInteractionsBound) {
        container.dataset.prismInteractionsBound = "true";

        container.addEventListener('mousedown', function(event) {
            event.preventDefault();
            prismInteractionState.suppressClick = false;
            prismInteractionState.startX = event.clientX;
            prismInteractionState.startY = event.clientY;
            prismInteractionState.lastMouseX = event.clientX;
            prismInteractionState.lastMouseY = event.clientY;

            if (event.button === 0) { // 左键
                document.addEventListener('mousemove', mouseMoveHandler);
                document.addEventListener('mouseup', function onMouseUp() {
                    document.removeEventListener('mousemove', mouseMoveHandler);
                    document.removeEventListener('mouseup', onMouseUp);
                    setTimeout(() => {
                        prismInteractionState.suppressClick = false;
                    }, 120);
                });
            } else if (event.button === 2) { // 右键
                document.addEventListener('mousemove', rightMouseMoveHandler);
                document.addEventListener('mouseup', function onMouseUp() {
                    document.removeEventListener('mousemove', rightMouseMoveHandler);
                    document.removeEventListener('mouseup', onMouseUp);
                    setTimeout(() => {
                        prismInteractionState.suppressClick = false;
                    }, 120);
                });
            }
        });

        container.addEventListener('contextmenu', function(event) {
            event.preventDefault();
        });

        container.addEventListener('wheel', function(event) {
            event.preventDefault();
            // perspectiveDistance += event.deltaY * 2;
            // container.style.perspective = `${perspectiveDistance}px`;
            prismScale = prismScale * 0.5 ** (event.deltaY / 1000);
            prismScale = Math.max(0.05, Math.min(8, prismScale));
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
        });
    }

    function mouseMoveHandler(event) {
        const movedDistance = Math.hypot(
            event.clientX - prismInteractionState.startX,
            event.clientY - prismInteractionState.startY,
        );
        if (movedDistance > 4) prismInteractionState.suppressClick = true;

        const deltaX = event.clientX - prismInteractionState.lastMouseX;
        const deltaY = event.clientY - prismInteractionState.lastMouseY;
        prismInteractionState.lastMouseX = event.clientX;
        prismInteractionState.lastMouseY = event.clientY;
        rotationAngleY += deltaX / 5;
        rotationAngleX -= deltaY / 5;
        rotationAngleX = Math.max(-90, Math.min(90, rotationAngleX));
        requestAnimationFrame(() => {
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
            updateOpacity()
        });
    }

    function rightMouseMoveHandler(event) {
        const movedDistance = Math.hypot(
            event.clientX - prismInteractionState.startX,
            event.clientY - prismInteractionState.startY,
        );
        if (movedDistance > 4) prismInteractionState.suppressClick = true;

        const deltaX = event.clientX - prismInteractionState.lastMouseX;
        const deltaY = event.clientY - prismInteractionState.lastMouseY;
        prismInteractionState.lastMouseX = event.clientX;
        prismInteractionState.lastMouseY = event.clientY;
        translationX += deltaX;
        translationY += deltaY;
        requestAnimationFrame(() => {
            prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px)  rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
        });
    }

    updateOpacity();
    startRotation(); // 初始化时开始旋转
}

function updateOpacity() {
    if(Math.abs(rotationAngleX) > 80) {
        d3.selectAll('.prism-slice-face').attr("fill-opacity", highlightOpacity);
        syncActiveSlice(null);
        activePrismFaceSliceId = null;
        setFocusedSliceIndex(-1);
        return;
    } else {
        if (getFocusedSliceIndex() == -1) {
            syncPrismFaceHighlight(null, true);
        }
    }

    const activeAngle = (720 - rotationAngleY) % 360;
    let newIndex = -1;
    const angleRanges = getSliceAngleRanges();
    for (let i = 0; i < angleRanges.length; i++) {
        const { startAngle, endAngle } = angleRanges[i];
        if (startAngle <= activeAngle && activeAngle < endAngle) {
        newIndex = i;
        break;
        }
    }

    const previousIndex = getFocusedSliceIndex();
    if (newIndex !== previousIndex) {
        highlight_arc_with_cash(newIndex, previousIndex);

        if (newIndex !== -1) {
            const activeSliceId = getActiveSlices()[newIndex]?.id;
            syncPrismFaceHighlight(activeSliceId);
            syncActiveSlice(activeSliceId);
        } else {
            syncPrismFaceHighlight(null);
            syncActiveSlice(null);
        }
        setFocusedSliceIndex(newIndex);
    }
}

function loadAndRender() {
    loadGlobalData();
    drawSliceTags();
    render();
}


function rotateTo(index, callback=undefined) {
    const prism = getContainerElement("prism");
    const angleRanges = getSliceAngleRanges();
    if (prism == undefined || angleRanges[index] == undefined) {
        if (callback) callback();
        return;
    }
    stopRotateToAnimation(true);
    prismRotateToRestoreSpeed = rotationSpeed;
    rotationSpeed = 0;
    // 计算目标角度
    let targetAngle = 360 - (angleRanges[index].startAngle + angleRanges[index].endAngle) / 2;
    const startAngle = rotationAngleY;

    // 确保目标角度和当前角度在同一范围内
    if (targetAngle - startAngle > 180) {
        targetAngle -= 360;
    } else if (startAngle - targetAngle > 180) {
        targetAngle += 360;
    }
    debugLog('targetAngle', targetAngle)
    debugLog('startAngle', startAngle)

    // 缓动动画参数
    const duration = 800; // 动画时长 1s
    const startTime = performance.now();
    function easeInOut(t) {
        return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    }

    // 动画帧更新函数
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easeInOut(progress);
        rotationAngleY = startAngle + (targetAngle - startAngle) * easedProgress;
        prism.style.transform = `scale(${prismScale}) translate(${translationX}px, ${translationY}px) rotateX(${rotationAngleX}deg) rotateY(${rotationAngleY}deg)`;
        updateOpacity();
        if (progress < 1) {
            prismRotateToFrame = requestAnimationFrame(animate);
        } else {
            prismRotateToFrame = null;
            rotationSpeed = prismRotateToRestoreSpeed == null ? rotationSpeed : prismRotateToRestoreSpeed;
            prismRotateToRestoreSpeed = null;
            if (callback) callback();
        }
    }

    // 启动动画
    prismRotateToFrame = requestAnimationFrame(animate);
}
function render() {
    yearGrid = $("#yearGrid").val();
    // alpha = $("#alphaSlider").val();
    // $("#yearGridValue").text(yearGrid);
    // $("#alphaValue").text(alpha);
    
    if (isScrollViewMode() && getContainerElement("scrollPanel")) {
        showGeneticFlow()
        updateSider(graph.entities || graph.nodes);
        return
    }

    const activeSliceId = getSelectedSliceId();
    const activeScrollGraph = activeSliceId != null ? getActiveSliceGraph(activeSliceId) : null;
    updateSider(activeScrollGraph ? activeScrollGraph.nodes : undefined);
    stopRotateToAnimation(true);
    rotationSpeed = getRotationSpeedForLevel(speedLevel);
    if (getViewMode()=="Prism") {
        hideAll()
        $(getContainerSelector("prismPanel")).show();
        drawGeneticPrism();
        const centerMarker = document.createElement('div');
        centerMarker.className = 'center-marker';
        const prismElement = getContainerElement("prism");
        if (prismElement) prismElement.appendChild(centerMarker);
    }
}

function highlightSlice(sliceId) {
    let duration = 200;
    d3.selectAll('.entity-node').style('opacity', virtualOpacity);
    d3.selectAll(`.entity-slice-${sliceId}`).style('opacity', 1);
    
    // =========================context-polygen=========================
    d3.selectAll(".context-polygon_" + sliceId)
        .style("fill-opacity", Math.min(1, topicOpacity * 2));
    d3.selectAll(".context-ellipse_" + sliceId)
        .style("fill-opacity", Math.min(1, topicOpacity * 2));

    // =========================tagcloud=========================
    highlight_tag(sliceId);

    // =========================arc & egroup=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", virtualOpacity)
        .style("stroke", "none");
    d3.selectAll(`.arc_${sliceId}`)
        .attr("fill-opacity", 1)

    d3.selectAll(".egroup").style("opacity", virtualOpacity); // virtualOpacity
    egroup = d3.selectAll(`.egroup_${sliceId}`)
        .style("opacity", 1);
    egroup.selectAll('.epath').style('stroke', 'red');
    egroup.selectAll('.epath-polygon').style('fill', 'red');
    
    // =========================bar & bar_egroup=========================
    d3.selectAll(".bar")
        .style("opacity", virtualOpacity);
    d3.selectAll(`.bar_${sliceId}`)
        .style("opacity", 0.7);

}

function highlightContextEdgesForSlice(sliceId, dir=null, streamSliceContext=null) {
    if (getSelectedSliceId() == null) return;
    const currentGraph = getActiveScrollGraph();
    if (!currentGraph || !currentGraph['combinedContextEdges']) return;

    const selectedContext = getContextEdgesForSlice(currentGraph, sliceId, dir, streamSliceContext);
    Object.entries(selectedContext).forEach(([key, value]) => {
        const topicWeight = getContextTopicWeight(value, sliceId);
        const weight = topicWeight == null ? value.weight : topicWeight;
        const width = Math.max(Number(weight || 1) * contextEdgeWeight, contextEdgeWeight);
        mouseoverEdge(key, width, streamContextEdgeColor);
        activeStreamContextEdgeKeys.add(key);
    })
}

function resetStreamContextEdgeHighlight() {
    activeStreamContextEdgeKeys.forEach(key => mouseoutEdge(key));
    activeStreamContextEdgeKeys.clear();
}


function resetSliceHighlight(d) {
    reset_tag();

    d3.selectAll('.egroup').style("opacity", 1);
    d3.selectAll('.entity-node').style('opacity', 1);

    d3.selectAll(".context-polygon")
        .style("fill-opacity", topicOpacity);
    d3.selectAll(".context-ellipse")
        .style("fill-opacity", topicOpacity);

    // =========================arc=========================
    d3.selectAll(".arc")
        .attr("fill-opacity", 1)
        .style("stroke", "none");

    tip.hide(d);

        
    // $("#GeneticFlow").attr("style", "background-color: white;");
    d3.selectAll(".bar").style("opacity", 0.7);
    // d3.selectAll(".bar_egroup").style("opacity", 1);

    matrixg.selectAll('.epath')
        .style("stroke", d=> d.color)
        .style("stroke-width", d=>d.width)
        .style('opacity', 1);
    matrixg.selectAll('.epath-polygon')
        .style("fill", d=>d.color)
        .style('opacity', 1);
}

function find_child_nodes(id, graph) { 
    var ids = [];
    const relations = graph.relations || graph.edges || [];
    for (let i = 0; i < relations.length; i++) {
        if (id == relations[i].source) {
            ids.push(relations[i].target);
        }
    }
    return ids;

}

function find_parent_nodes(id, graph) {
    var ids = [];
    const relations = graph.relations || graph.edges || [];
    for (let i = 0; i < relations.length; i++) {
        if (id == relations[i].target) {
            ids.push(relations[i].source);
        }
    }
    return ids;
}

function get_neighbor(ids, graph) {
    var neighbor_ids = [];
    for (let i = 0; i < ids.length; i++) {
        neighbor_ids = neighbor_ids.concat(find_child_nodes(ids[i], graph));
        neighbor_ids = neighbor_ids.concat(find_parent_nodes(ids[i], graph));
    }
    neighbor_ids = Array.from(new Set(neighbor_ids));
    return neighbor_ids;
}
function updateOutlineColor(isKeyPaper, citationCount) {
    let outlineColorVal = $("#outline-color").val();
    if (outlineColorVal == 0)  return 'black';
    if (outlineColorVal == 1)  return isKeyPaper >= 0.5? 'red': 'black';
    
    // outlineColorVal == 2
    if (citationCount < 50)   return '#2271E0'; // back
    else if (citationCount < 100) return 'DarkOrange';
    return 'red';
}
function downloadSVGElement(elementId) {
    // 获取 SVG 元素
    const svgElement = document.getElementById(elementId);

    // 确保元素存在
    if (svgElement) {
        // 将 SVG 元素序列化为字符串
        const serializer = new XMLSerializer();
        const source = serializer.serializeToString(svgElement);

        // 创建 Blob 对象
        const svgBlob = new Blob(['<?xml version="1.0" standalone="no"?>\r\n' + source], { type: 'image/svg+xml;charset=utf-8' });

        // 创建 URL 对象
        const url = URL.createObjectURL(svgBlob);

        // 创建临时下载链接
        const downloadegroup = document.createElement('a');
        downloadegroup.href = url;
        downloadegroup.download = elementId + '.svg';

        // 触发下载
        document.body.appendChild(downloadegroup);
        downloadegroup.click();

        // 清理临时链接和 URL 对象
        document.body.removeChild(downloadegroup);
        URL.revokeObjectURL(url);
    } else {
        console.error(`SVG element with id "${elementId}" not found.`);
    }
}


function downloadSvg(svgList, fileName) {
    var totalWidth = 0;
    svgList.forEach(svg => {
        totalWidth += svg.width.baseVal.value;
    });
    var averageWidth = totalWidth / svgList.length;
    var maxWidth = Math.max(...svgList.map(svg => svg.width.baseVal.value));

    var imagesLoaded = 0;
    var canvasList = [];

    var ratio = 1;
    svgList.forEach((svg, index) => {
        const localCnt = index; // 为每个索引创建一个局部变量
        const svgString = new XMLSerializer().serializeToString(svg);
        var source = '<?xml version="1.0" standalone="no"?>\r\n' + svgString;

        var image = new Image();
        image.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(source);

        image.onload = function() {
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = maxWidth;

            var scale = maxWidth / svg.width.baseVal.value;
            canvas.height = svg.height.baseVal.value * scale;
            if (localCnt >= 1) ratio = ratio * 0.5;

            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            if (svg.width.baseVal.value < averageWidth) {
                // 放大并居中
                ctx.drawImage(image, 0, 0, svg.width.baseVal.value * scale, canvas.height);
            } else {
                // 直接居中
                ctx.drawImage(image, (maxWidth - svg.width.baseVal.value * scale) / 2, 0, svg.width.baseVal.value * scale, canvas.height);
            }

            canvasList.push(canvas);
            imagesLoaded++;

            if (imagesLoaded === svgList.length) {
                combineCanvases(canvasList, fileName);
            }
        };
    });
}

function combineCanvases(canvasList, fileName) {
    var totalHeight = canvasList.reduce((sum, canvas) => sum + canvas.height, 0);
    var maxWidth = Math.max(...canvasList.map(canvas => canvas.width));

    var finalCanvas = document.createElement('canvas');
    finalCanvas.width = maxWidth;
    finalCanvas.height = totalHeight;
    var ctx = finalCanvas.getContext('2d');

    var currentY = 0;
    canvasList.forEach(canvas => {
        ctx.drawImage(canvas, 0, currentY, canvas.width, canvas.height);
        currentY += canvas.height;
    });

    var imgSrc = finalCanvas.toDataURL("image/png");

    downloadFile(fileName, dataURLtoBlob(imgSrc));
}

function downloadFile(fileName, blob) {
    var a = document.createElement('a');
    var url = window.URL.createObjectURL(blob);
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(function() {
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
    }, 0);
}

function dataURLtoBlob(dataurl) {
    var arr = dataurl.split(','), mime = arr[0].match(/:(.*?);/)[1],
        bstr = atob(arr[1]), n = bstr.length, u8arr = new Uint8Array(n);
    while(n--){
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], {type:mime});
}


function getZoomSvg(svgIdName, groupIdName) {
    var svg = d3.select(svgIdName).node();
    //得到svg的真实大小
    var box = svg.getBBox(),
        x = box.x,
        y = box.y,
        width = box.width,
        height = box.height;
    if(groupIdName) {
        //查找group
        var group = d3.select(groupIdName).node();
        if(!group) {
            alert('svg中group不存在');
            return false;
        }
        /* 这里是处理svg缩放的 */
        var transformObj = group.getAttribute('transform');
        if(transformObj) {
            /* 下面捕获由d3.event自动引起的svg移动 */
            var translateObj = transformObj.match(/translate\((\d+\.?\d*) (\d+\.?\d*)\)/),
                scaleObj = transformObj.match(/scale\((\d+(\.\d+)?)(?:\s+|\s*,\s*)(\d+(\.\d+)?)\)/);
            if(translateObj && scaleObj) {               // 匹配到平移和缩放
                var translateX = translateObj[1],
                    translateY = translateObj[2],
                    scale = scaleObj[1];
                x = (box.x - translateX) / scale;
                y = (box.y - translateY) / scale;
                width = box.width / scale;
                height = box.height / scale;
            }
            /* 下面捕获初始时手动设置的translate */
            var translateManual = transformObj.match(/translate\(([^,]+),\s*([^\)]+)\)/);
            if (translateManual) {                      // 如果svg的移动不单靠d3.event捕获的，初始时也有一个手动translate，需要将它捕获并减掉
                x = x - parseFloat(translateManual[1]);
                y = y - parseFloat(translateManual[2]);
            }
        }
    }
    //克隆svg
    var cloneSvg = svg.cloneNode(true);
    //重新设置svg的width,height,viewbox
    cloneSvg.setAttribute('width', width);
    cloneSvg.setAttribute('height', height);
    cloneSvg.setAttribute('viewBox', [x, y, width, height]);
    if(group) {
        var cloneGroup = cloneSvg.getElementById(groupIdName.replace(/\#/g, ''));
        /*------清楚缩放元素的缩放--------*/
        cloneGroup.setAttribute('transform', 'translate(0,0) scale(1)');
    }
    return cloneSvg;
}

async function fetchFontAsBase64(url) {
    const response = await fetch(url);
    const blob = await response.blob();
    
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}


function combineAndDownloadSVG(svgDataArray, fileName) {
// 嵌入 Base64 字体
fetchFontAsBase64('ArchivoNarrow-Regular.ttf').then(base64Font => {
        // 创建一个新的 SVG 容器并开始拼接
    let yOffset = 0; // 用于累积每个 SVG 的 Y 轴偏移
    let combinedHeight = 0; // 用于计算所有 SVG 合并后的总高度
    let maxSvgWidth = 0; // 用于计算所有 SVG 中的最大宽度
    let combinedSvgContent = `
        <svg xmlns="http://www.w3.org/2000/svg" width="###WIDTH###" height="###HEIGHT###" viewBox="0 0 ###WIDTH### ###HEIGHT###">
            <style type="text/css">
                @font-face {
                    font-family: 'Archivo Narrow';
                    src: url('${base64Font}') format('truetype');
                }
                text {
                    font-family: 'Archivo Narrow';
                }
            </style>
    `;

    // 遍历所有 SVG 数据，依次拼接并平移
    svgDataArray.forEach((data, index) => {
        // 从 SVG 数据中提取宽度和高度
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = data;
        const svgElement = tempDiv.querySelector('svg');

        // 获取当前 SVG 的高度
        const svgHeight = svgElement.getAttribute('height');
        const svgWidth = svgElement.getAttribute('width');
        maxSvgWidth = Math.max(maxSvgWidth, parseFloat(svgWidth));

        // 添加到组合的 SVG 并平移
        combinedSvgContent += `
            <g id="svgGroup${index}" transform="translate(0, ${yOffset})">
                ${data}
            </g>
        `;
        
        // 更新 Y 轴的偏移量
        yOffset += parseFloat(svgHeight);
        combinedHeight += parseFloat(svgHeight);
    });

    // 闭合 SVG 标签，并将计算后的总高度应用到 SVG 的 viewBox 和高度属性中
    combinedSvgContent += `</svg>`;
    combinedSvgContent = combinedSvgContent.replace('###HEIGHT###', combinedHeight);
    combinedSvgContent = combinedSvgContent.replace('###WIDTH###', maxSvgWidth);
        
    // 转换为 Blob 并下载
    const blob = new Blob([combinedSvgContent], { type: 'image/svg+xml;charset=utf-8' });
    downloadFile(fileName, blob);
})
}


// ============ 组件绑定函数 ============

/**
 * 绑定和弦图面板
 * @param {string} elementId - 容器元素的ID
 */
function bindChordPanel(elementId = getContainerId("chordPanel"), options = {}) {
    const resolved = resolvePanelElementArgs(elementId, options, "chordPanel");
    elementId = resolved.elementId;
    options = resolved.options;
    const selector = normalizeElementSelector(elementId);
    const container = d3.select(selector);
    
    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return;
    }

    chordPanelElementId = getOrCreateElementId(container, "chord-panel");
    configurePrismVizContainers(options, {chordPanel: chordPanelElementId});
    container.selectAll("*").remove();
    container.style("position", "relative");
    
    // 创建 Polygen View 切换按钮
    container.append("button")
        .attr("id", "toggle-polygen")
        .style("position", "absolute")
        .style("top", "10px")
        .style("left", "20px")
        .style("padding", "5px 10px")
        .attr("data-prismviz-label", "polygenView")
        .text(labelText("polygenView", "Polygen View"))
        .on("click", function() {
            polygenView = !polygenView;
            d3.select(this)
                .attr("data-prismviz-label", polygenView ? "normalView" : "polygenView")
                .text(polygenView
                    ? labelText("normalView", "Normal View")
                    : labelText("polygenView", "Polygen View"));
            draw_chord();
        });
    
    // 创建和弦图内容容器
    const contentId = normalizeElementId(options.contentContainerId || options.chordContentId || options.chordContentContainerId || "") || (chordPanelElementId === getContainerId("chordPanel") || chordPanelElementId === getLegacyContainerId("chordPanel")
        ? getContainerId("chordContent")
        : `${chordPanelElementId}-content`);
    container.append("div")
        .attr("id", contentId);
    configurePrismVizContainers(options, {chordContent: contentId});
    chordContentSelector = `#${contentId}`;
}

/**
 * 绑定主可视化面板
 * @param {string} elementId - 容器元素的ID
 * @param {Object} options - 可选配置；includeFlow=true 时保留旧 GeneticFlow 容器
 */
function bindMainPanel(elementId = getContainerId("mainPanel"), options = {}) {
    const resolved = resolvePanelElementArgs(elementId, options, "mainPanel");
    elementId = resolved.elementId;
    options = resolved.options;
    const selector = normalizeElementSelector(elementId);
    const container = d3.select(selector);
    
    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return;
    }

    mainPanelElementId = getOrCreateElementId(container, "prism-main-panel");
    configurePrismVizContainers(options, {mainPanel: mainPanelElementId}, true);
    mainPanelOptions = {
        includeFlow: false,
        showModeSwitch: null,
        onSelectSlice: null,
        ...options,
    };
    if (mainPanelOptions.showModeSwitch == null) {
        mainPanelOptions.showModeSwitch = mainPanelOptions.includeFlow;
    }
    if (mainPanelOptions.labels) {
        setPrismVizLabels(mainPanelOptions.labels);
    }
    if (mainPanelOptions.filterVisibility || mainPanelOptions.filterControls) {
        setPrismVizFilterVisibility(mainPanelOptions.filterVisibility || mainPanelOptions.filterControls);
    }

    container.selectAll("*").remove();
    container.style("overflow", "hidden");
    
    // 创建工具提示
    container.append("div")
        .attr("id", "tag-tooltip")
        .attr("class", "tooltip");
    
    // 创建顶部工具栏
    const topToolbar = container.append("div")
        .style("z-index", "9")
        .style("position", "absolute")
        .style("right", "10px")
        .style("top", "10px")
        .style("display", "flex")
        .style("gap", "10px")
        .style("align-items", "center");
    
    // 定义顶部工具栏按钮
    const topButtons = [
        { id: "zoom-in", icon: "fa-solid fa-plus", tooltipKey: "zoomIn", tooltip: "Zoom In" },
        { id: "zoom-out", icon: "fa-solid fa-minus", tooltipKey: "zoomOut", tooltip: "Zoom Out" },
        { id: "fullscreen", icon: "fa-solid fa-maximize", tooltipKey: "fullscreen", tooltip: "Fullscreen" },
        { id: "toggle-hide", icon: "fa-solid fa-chevron-down", tooltipKey: "moreTools", tooltip: "More Tools" }
    ];

    if (mainPanelOptions.includeFlow) {
        topButtons.splice(3, 0, { id: "saveall", icon: "fa-solid fa-download", tooltipKey: "downloadSvg", tooltip: "Download SVG" });
    }

    if (mainPanelOptions.showModeSwitch) {
        topButtons.splice(4, 0, { id: "switch-mode", icon: "fa-solid fa-repeat", tooltipKey: "viewModeScroll", tooltip: "View Mode: GeneticFlow" });
    }
    
    topButtons.forEach(btn => {
        const button = topToolbar.append("button")
            .attr("id", btn.id)
            .attr("class", "icon-button")
            .attr("data-prismviz-tooltip", btn.tooltipKey)
            .attr("data-prismviz-tooltip-fallback", btn.tooltip)
            .attr("data-tooltip", labelText(btn.tooltipKey, btn.tooltip))
            .attr("title", labelText(btn.tooltipKey, btn.tooltip));
        
        button.append("i")
            .attr("class", `${btn.icon} icon`);
    });

    const speedControlHost = d3.select("#prism-speed-slot");
    if (!speedControlHost.empty()) {
        speedControlHost.html("");
    }

    const speedControlParent = speedControlHost.empty() ? topToolbar : speedControlHost;
    const speedControl = speedControlParent.append("label")
        .attr("id", "rotation-speed-control")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "6px")
        .style("min-width", "0")
        .style("padding", "4px 8px")
        .style("border-radius", "12px")
        .style("background", "rgba(255,255,255,0.78)")
        .style("font-size", "12px")
        .style("color", "#333");

    if (!speedControlHost.empty()) {
        speedControl
            .style("width", "100%")
            .style("justify-content", "flex-start")
            .style("padding", "0")
            .style("background", "transparent")
            .style("border-radius", "0")
            .style("gap", "8px")
            .style("min-width", "0");
    }

    speedControl.append("span")
        .attr("id", "rotation-speed-label")
        .style("min-width", "28px")
        .style("text-align", "right")
        .text(`${speedMultipliers[speedLevel]}x`);

    speedControl.append("input")
        .attr("id", "rotation-speed-slider")
        .attr("type", "range")
        .attr("min", 0)
        .attr("max", speedMultipliers.length - 1)
        .attr("step", 1)
        .attr("value", speedLevel)
        .style("flex", speedControlHost.empty() ? null : "1 1 auto")
        .style("min-width", speedControlHost.empty() ? null : "56px")
        .style("width", speedControlHost.empty() ? "92px" : "100%");

    const tagScaleHost = d3.select("#tag-scale-slot");
    if (!tagScaleHost.empty()) {
        tagScaleHost.html("");
    }

    const tagScaleParent = tagScaleHost.empty() ? topToolbar : tagScaleHost;
    const tagScaleControl = tagScaleParent.append("label")
        .attr("id", "tag-scale-control")
        .style("display", "flex")
        .style("align-items", "center")
        .style("gap", "8px")
        .style("min-width", "0")
        .style("padding", "4px 8px")
        .style("border-radius", "12px")
        .style("background", "rgba(255,255,255,0.78)")
        .style("font-size", "12px")
        .style("color", "#333");

    if (!tagScaleHost.empty()) {
        tagScaleControl
            .style("width", "100%")
            .style("justify-content", "flex-start")
            .style("padding", "0")
            .style("background", "transparent")
            .style("border-radius", "0")
            .style("min-width", "0");
    }

    tagScaleControl.append("span")
        .attr("id", "tag-scale-label")
        .style("min-width", "36px")
        .style("text-align", "right")
        .text(`${tagScalePercent}%`);

    tagScaleControl.append("input")
        .attr("id", "tag-scale-slider")
        .attr("type", "range")
        .attr("min", 60)
        .attr("max", 100)
        .attr("step", 5)
        .attr("value", tagScalePercent)
        .style("flex", tagScaleHost.empty() ? null : "1 1 auto")
        .style("min-width", tagScaleHost.empty() ? null : "56px")
        .style("width", tagScaleHost.empty() ? "92px" : "100%");
    
    topToolbar.append("span")
        .attr("id", "info-text")
        .attr("data-prismviz-label", "visualizationGuide")
        .text(labelText("visualizationGuide", "Visualization Guide"));
    
    // 创建工具箱
    const toolbox = container.append("div")
        .attr("id", "toolbox")
        .style("z-index", "9")
        .style("position", "absolute")
        .style("top", "60px")
        .style("right", "10px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "10px");
    
    // 定义工具箱按钮
    const toolboxButtons = [
        { id: "restore", icon: "fa-solid fa-rotate-right", tooltipKey: "refresh", tooltip: "Refresh" },
        { id: "showtag", icon: "fa-solid fa-tag", tooltipKey: "showTag", tooltip: "Show Tag" },
        { id: "regular", icon: "fa-solid fa-circle", tooltipKey: "regularNodeShape", tooltip: "Regular Node Shape" },
        { id: "collapse", icon: "fa-solid fa-equals", tooltipKey: "collapse", tooltip: "Collapse" },
        { id: "enlarge", icon: "fa-solid fa-magnifying-glass", tooltipKey: "enlargeNode", tooltip: "Enlarge Node" },
        { id: "showtagcloud", icon: "fa-solid fa-tags", tooltipKey: "showTagCloud", tooltip: "Show Tag Cloud" }
    ];

    if (mainPanelOptions.includeFlow) {
        toolboxButtons.splice(3, 0, { id: "hide-background", icon: "fa-solid fa-eye-slash", tooltipKey: "hideFlowMap", tooltip: "Hide FlowMap" });
        toolboxButtons.splice(5, 0, { id: "fullsize", icon: "fa-solid fa-expand", tooltipKey: "fullSize", tooltip: "Full Size" });
    }
    
    toolboxButtons.forEach(btn => {
        const button = toolbox.append("button")
            .attr("id", btn.id)
            .attr("class", "icon-button")
            .attr("data-prismviz-tooltip", btn.tooltipKey)
            .attr("data-prismviz-tooltip-fallback", btn.tooltip)
            .attr("data-tooltip", labelText(btn.tooltipKey, btn.tooltip))
            .attr("title", labelText(btn.tooltipKey, btn.tooltip));
        
        button.append("i")
            .attr("class", `${btn.icon} icon`);
    });
    
    // 创建主绘图区域
    const drawArea = container.append("div")
        .attr("id", getContainerId("drawArea"))
        .style("display", "grid")
        .style("height", "100%")
        .style("position", "relative")
        .style("overflow", "hidden");
    
    if (mainPanelOptions.includeFlow) {
        drawArea.append("div")
            .attr("id", getContainerId("scrollPanel"))
            .style("position", "absolute")
            .style("top", "0")
            .style("left", "0")
            .style("right", "0")
            .style("bottom", "0")
            .style("overflow", "hidden");
    }
    
    // 创建 GeneticPrism 容器
    const prismDiv = drawArea.append("div")
        .attr("id", getContainerId("prismPanel"))
        .style("display", "none")
        .style("position", "absolute")
        .style("inset", "0");
    
    const prismContainer = prismDiv.append("div")
        .attr("id", getContainerId("prismContainer"))
        .style("width", "100%")
        .style("height", "100%");
    
    prismContainer.append("div")
        .attr("id", getContainerId("prism"));
    
    // 创建标签云容器
    drawArea.append("div")
        .attr("id", getContainerId("tagCloud"))
        .style("position", "absolute")
        .style("height", "24%")
        .style("width", "100%")
        .style("left", "0px")
        .style("bottom", "12px")
        .style("z-index", "6");

    applyPrismVizLabels(container.node());
    applyPrismVizFilterVisibility();
}

function bindPrismPanel(elementId = getContainerId("mainPanel"), options = {}) {
    return bindMainPanel(elementId, options);
}

/**
 * 绑定论文列表面板
 * @param {string} elementId - 容器元素的ID
 */
function bindListPanel(elementId = getContainerId("listPanel"), options = {}) {
    const resolved = resolvePanelElementArgs(elementId, options, "listPanel");
    elementId = resolved.elementId;
    options = resolved.options;
    const selector = normalizeElementSelector(elementId);
    const container = d3.select(selector);
    
    if (container.empty()) {
        console.error(`Element ${selector} not found`);
        return;
    }

    configurePrismVizContainers(options, {listPanel: getOrCreateElementId(container, "list-panel")});
    
    // 设置容器样式
    container
        .style("overflow", "auto")
        .style("background-color", "#f5fafa")
        .style("color", "#333")
        .style("padding-top", "3%")
        .style("padding-left", "6%");
}

/**
 * 绑定可配置层级 -> Slice 的最小树面板。
 * @param {string} elementId - 容器元素的ID
 * @param {Array<Object>} rows - slice hierarchy / field_leaves.csv 读入后的行
 * @param {Object} options - 可选配置
 */
function bindTreePanel(elementId = "tree", rows = [], options = {}) {
    const container = d3.select(`#${elementId}`);

    if (container.empty()) {
        console.error(`Element #${elementId} not found`);
        return;
    }

    const maxLevel = options.maxLevel == null ? 2 : parseInt(options.maxLevel, 10);
    const selectableLevel = options.selectableLevel == null ? maxLevel : parseInt(options.selectableLevel, 10);
    const selectableIds = new Set((options.selectableIds || []).map(id => String(id)));
    const normalizedRows = normalizeSliceHierarchyRows(rows, options);
    const nodes = normalizedRows
        .map(row => ({
            ...row,
            id: String(row.id ?? row.Topic),
            parentId: String(row.parentId ?? row.parentTopic),
            level: parseInt(row.level || 0, 10),
            isLeaf: String(row.isLeaf).toLowerCase() === "true",
            nodeType: row.nodeType === "topic" ? "slice" : (row.nodeType || "slice"),
            name: row.name || row.Name || String(row.id ?? row.Topic),
        }))
        .filter(row => row.level <= maxLevel);

    const nodeById = {};
    nodes.forEach(node => {
        node.children = [];
        nodeById[node.id] = node;
    });

    const roots = [];
    nodes.forEach(node => {
        const parent = nodeById[node.parentId];
        if (parent) {
            parent.children.push(node);
        } else {
            roots.push(node);
        }
    });

    container
        .html("")
        .attr("class", "slice-tree")
        .style("background-color", "white");

    function renderNode(node) {
        const item = container.append("div")
            .datum(node)
            .attr("class", `tree-node tree-node-${node.nodeType}`)
            .attr("data-node-id", node.id)
            .attr("data-node-type", node.nodeType)
            .style("padding-left", `${12 + node.level * 18}px`)
            .on("click", function() {
                if (typeof options.onSelect === "function") {
                    options.onSelect(node);
                }

                try {
                    const isSelectableSlice = selectableIds.has(node.id) || node.level === selectableLevel;
                    if (isSelectableSlice) {
                        handleSliceTagClick(node.id, "tree");
                    } else if (isScrollViewMode()) {
                        closeScrollToPrism(getSelectedSliceId(), {
                            rotate: false,
                            source: "tree-group",
                        });
                    }
                } catch (error) {
                    console.warn("Tree interaction skipped:", error);
                }
            });

        item.append("span")
            .attr("class", "tree-node-label")
            .text(node.name);

        node.children.forEach(renderNode);
    }

    roots.forEach(renderNode);
}

function bindSliceTreePanel(elementId = "tree", rows = [], options = {}) {
    return bindTreePanel(elementId, rows, options);
}
const prismVizAbstractApi = {
    loadData: loadData,
    unpackDataPackage: unpackPrismVizInputPackage,
    normalizeData: normalizePrismVizInput,
    normalizeInput: normalizePrismVizInput,
    normalizeSliceHierarchyRows: normalizeSliceHierarchyRows,
    updateNodeProb: updateNodeProb,
    updateEdgeProb: updateEdgeProb,
    updateEntityThreshold: updateNodeProb,
    updateRelationThreshold: updateEdgeProb,
    updateSliceThreshold: updateSliceThreshold,
    updateYearGrid: updateYearGrid,
    bindTreePanel: bindTreePanel,
    bindSliceTreePanel: bindSliceTreePanel,
    bindChordPanel: bindChordPanel,
    bindMainPanel: bindMainPanel,
    bindPrismPanel: bindPrismPanel,
    bindListPanel: bindListPanel,
    preparePrismVizModels: preparePrismVizModels,
    prepareModels: preparePrismVizModels,
    applyPrismVizModels: applyPrismVizModels,
    applyModels: applyPrismVizModels,
    buildChordModel: buildChordModel,
    buildSliceRelationModel: buildSliceRelationModel,
    renderChordPanel: renderChordPanel,
    renderChord: renderChord,
    buildScrollModel: buildScrollModel,
    bindScrollPanel: bindScrollPanel,
    renderScrollPanel: renderScrollPanel,
    renderScroll: renderScroll,
    selectSlice: selectSlice,
    openScrollForSlice: openScrollForSlice,
    closeScrollToPrism: closeScrollToPrism,
    clearSelectedSlice: () => selectSlice(null, { source: "api" }),
    getSelectedSlice: () => getSelectedSliceDetail(getSelectedSliceId()),
    getDisplayInfo: () => cloneJSON(globalDisplayInfo),
    getComponentOptions: () => cloneJSON(globalComponentOptions),
    getTreeRows: () => cloneJSON(globalTreeRows),
    setLabels: setPrismVizLabels,
    getLabels: getPrismVizLabels,
    applyLabels: applyPrismVizLabels,
    setFilterVisibility: setPrismVizFilterVisibility,
    getFilterVisibility: getPrismVizFilterVisibility,
    applyFilterVisibility: applyPrismVizFilterVisibility,
    setScrollOptions: setPrismVizScrollOptions,
    getScrollOptions: getPrismVizScrollOptions,
    highlight_node: highlight_node,
    reset_node: reset_node,
};

d3.prismViz = {
    ...prismVizAbstractApi,
};
})();
