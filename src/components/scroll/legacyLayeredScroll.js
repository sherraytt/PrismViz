// Legacy layered Scroll renderer migrated from the original PrismViz source.
//
// This module keeps the original reference time-layered Scroll data preparation
// and SVG rendering path available without loading the full legacy PrismViz file.

const d3 = globalThis.d3;
const $ = globalThis.jQuery || globalThis.$;

if (d3) {


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
}
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
let topic2graph = {};
let sliceGraphs = {};
let selectedSliceId = null;
let STopic = null;
let paperID2year = {};
let entityIdToTime = {};
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
let globalComponentOptions = {};
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
const PRISMVIZ_LAYERED_LAYOUT_MODES = new Set([
    "layered-time",
    "layered-explicit",
    "layered-inferred",
    "layered-scroll",
]);
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
        survey: ["survey", "isSpecial", "meta.survey"],
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

    if (primarySliceId != null && !Object.prototype.hasOwnProperty.call(weights, String(primarySliceId))) {
        weights[String(primarySliceId)] = 1;
    }
    return weights;
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

function hideFloatingTips() {
    d3.selectAll(".d3-tip")
        .style("opacity", 0)
        .style("pointer-events", "none");
}

function renderScrollPanel(elementId = getContainerId("scrollPanel"), scrollModel = null, options = {}) {
    if (isPlainObject(elementId)) {
        const secondArg = scrollModel;
        const resolved = resolvePanelElementArgs(elementId, {}, "scrollPanel");
        elementId = resolved.elementId;
        const secondArgLooksLikeModel = isPlainObject(secondArg)
            && (secondArg.graph || secondArg.sliceId != null || secondArg.topicId != null);
        scrollModel = resolved.options.scrollModel
            || resolved.options.model
            || (secondArgLooksLikeModel ? secondArg : null);
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

    const safeWeights = (Array.isArray(weigths) ? weigths : [])
        .map(weight => Math.max(0, toNumberOrDefault(weight, 0)));
    if (safeWeights.length === 0) return [];

    let total = safeWeights.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(total) || total <= 0) return safeWeights.map(() => 0);

    let current = total;
    let radii = []
    safeWeights.forEach(w => {
        const radius = current / total;
        radii.push(Number.isFinite(radius) ? Math.max(0, Math.min(1, radius)) : 1);
        current -= w;
    })
    return radii;
}

function getNodeSliceWeights(node = {}) {
    return node.sliceWeights || node.topicDist || {};
}

function getNodePrimarySliceId(node = {}, fallbackSliceId = null) {
    return node.primarySliceId ?? node.topic ?? fallbackSliceId;
}

function getNodeSliceWeight(node = {}, sliceId, fallbackSliceId = null) {
    if (sliceId === undefined || sliceId === null) return 0;
    const key = String(sliceId);
    const weights = getNodeSliceWeights(node);
    if (weights && Object.prototype.hasOwnProperty.call(weights, key)) {
        return toNumberOrDefault(weights[key], 0);
    }
    const fallbackKey = getNodePrimarySliceId(node, fallbackSliceId);
    return fallbackKey != null && String(fallbackKey) === key ? 1 : 0;
}

function calculateNodeTopicRadii(node = {}, topics = [], fallbackSliceId = null) {
    const safeTopics = topics.filter(topic => topic !== undefined && topic !== null);
    const weights = safeTopics.map(topic => getNodeSliceWeight(node, topic, fallbackSliceId));
    if (weights.some(weight => weight > 0)) return calculateRadii(weights);

    const fallbackTopic = getNodePrimarySliceId(node, fallbackSliceId);
    if (fallbackTopic == null) return calculateRadii(weights);
    topics.length = 0;
    topics.push(fallbackTopic);
    return [1];
}

function finiteNumberOrNull(value) {
    const numberValue = Number(value);
    return Number.isFinite(numberValue) ? numberValue : null;
}

function parseSvgNumberList(value) {
    if (value === undefined || value === null) return [];
    const matches = String(value).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi);
    if (!matches) return [];
    return matches
        .map(item => Number(item))
        .filter(Number.isFinite);
}

function parseSvgPolygonPoints(value) {
    const numbers = parseSvgNumberList(value);
    const points = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({x: numbers[index], y: numbers[index + 1]});
    }
    return points;
}

function getPolygonBounds(points = []) {
    if (!Array.isArray(points) || points.length === 0) return null;
    const xs = points.map(point => point.x).filter(Number.isFinite);
    const ys = points.map(point => point.y).filter(Number.isFinite);
    if (xs.length === 0 || ys.length === 0) return null;
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
        cx: (minX + maxX) / 2,
        cy: (minY + maxY) / 2,
        rx: Math.max((maxX - minX) / 2, 1),
        ry: Math.max((maxY - minY) / 2, 1),
    };
}

function sanitizeSvgPolygonPoints(value) {
    const points = parseSvgPolygonPoints(value);
    if (points.length === 0) return null;
    return points.map(point => `${point.x},${point.y}`).join(' ');
}

function getSafeNodeGeometry(node = {}) {
    const x = finiteNumberOrNull(node.x);
    const y = finiteNumberOrNull(node.y);
    if (x === null || y === null) return null;
    const rx = finiteNumberOrNull(node.rx);
    const ry = finiteNumberOrNull(node.ry);
    const safeRx = Math.max(rx ?? 1, 1);
    const safeRy = Math.max(ry ?? safeRx, 1);
    return {x, y, rx: safeRx, ry: safeRy};
}

function getSafeRadiusScale(value) {
    const radius = finiteNumberOrNull(value);
    return radius !== null && radius > 0 ? radius : 0;
}

function buildHexagonPointString(geometry, radiusScale, enlargeRatio) {
    if (!geometry) return null;
    const scale = getSafeRadiusScale(radiusScale);
    const ratio = getSafeRadiusScale(enlargeRatio) || 1;
    if (scale <= 0) return null;
    const rx = geometry.rx * scale * ratio;
    const ry = geometry.ry * scale * ratio;
    const {x, y} = geometry;
    const points = [
        [x + rx, y],
        [x + rx / 2, y + ry],
        [x - rx / 2, y + ry],
        [x - rx, y],
        [x - rx / 2, y - ry],
        [x + rx / 2, y - ry],
    ];
    return points.every(point => point.every(Number.isFinite))
        ? points.map(point => point.join(',')).join(' ')
        : null;
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
        const title = node.querySelector('title')?.textContent;
        const shape = node.querySelector('ellipse, polygon, rect'); // 支持椭圆或多边形
        const text = node.querySelector('text');
        if (!title || !shape) return;

        let cx, cy, rx, ry;
        const tagName = String(shape.tagName || "").toLowerCase();

        if (tagName === 'ellipse') {
            cx = finiteNumberOrNull(shape.getAttribute('cx'));
            cy = finiteNumberOrNull(shape.getAttribute('cy'));
            rx = finiteNumberOrNull(shape.getAttribute('rx'));
            ry = finiteNumberOrNull(shape.getAttribute('ry'));
        } else if (tagName === 'rect') {
            const x = finiteNumberOrNull(shape.getAttribute('x'));
            const y = finiteNumberOrNull(shape.getAttribute('y'));
            const width = finiteNumberOrNull(shape.getAttribute('width'));
            const height = finiteNumberOrNull(shape.getAttribute('height'));
            if (x === null || y === null || width === null || height === null) return;

            cx = x + width / 2;
            cy = y + height / 2;
            rx = width / 2;
            ry = height / 2;
        } else if (tagName === 'polygon') {
            const bounds = getPolygonBounds(parseSvgPolygonPoints(shape.getAttribute('points')));
            if (!bounds) return;
            cx = bounds.cx;
            cy = bounds.cy;
            rx = bounds.rx;
            ry = bounds.ry;
        }
        if (![cx, cy, rx, ry].every(Number.isFinite)) return;
        rx = Math.max(Math.abs(rx), 1);
        ry = Math.max(Math.abs(ry), 1);

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
        const title = edge.querySelector('title')?.textContent?.replace(/:w|:e/g, '');
        if (!title) return;
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
                points: sanitizeSvgPolygonPoints(polygon.getAttribute('points'))
            } : null
        };
    });
    // graph['viewBox'] = graph['svgElement'].getAttribute('viewBox');
    // let viewBoxHeight = parseFloat(graph['viewBox'].split(' ')[3]);
    // let transform = `translate(0,${viewBoxHeight})`;
    // graph['transform'] = graph['svgElement'].getAttribute('transform');

    if (![minX, minY, maxX, maxY].every(Number.isFinite)) {
        const viewBox = parseSvgNumberList(graph['svgElement'].getAttribute('viewBox'));
        if (viewBox.length >= 4) {
            minX = viewBox[0];
            minY = viewBox[1];
            maxX = viewBox[0] + viewBox[2];
            maxY = viewBox[1] + viewBox[3];
        } else {
            minX = 0;
            minY = 0;
            maxX = toNumberOrDefault(graph['width'], 1);
            maxY = toNumberOrDefault(graph['height'], 1);
        }
    }

    graph['viewBox'] = `${minX} ${minY} ${maxX - minX} ${maxY - minY}`;
    graph['transform'] = `translate(0,${maxY - minY})`;

    graph['nodes'].forEach(node => {
        const attrs = graph['id2attr'][node.id];
        if (attrs && getSafeNodeGeometry(attrs)) Object.assign(node, attrs);
    });
    graph['edges'].forEach(edge => {
        let edgeKey = edge.source + '->' + edge.target;
        if (graph['id2attr'][edgeKey]) Object.assign(edge, graph['id2attr'][edgeKey]);  // 合并边的属性
    });
}

// 获取路径的起点或终点
function getEndPoint(d, type) {
    const numbers = parseSvgNumberList(d);
    const points = [];
    for (let index = 0; index + 1 < numbers.length; index += 2) {
        points.push({x: numbers[index], y: numbers[index + 1]});
    }
    if (points.length === 0) return { x: 0, y: 0 };
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
                    if (node?.topicDist?.[topic]) node.influx = topic;
                })
            } else {
                let nodeId = name.split('->')[0];
                let node = graph['nodes'].find(node => node.id == nodeId);
                const entitySliceMap = getActiveEntitySliceMap();
                let topics = edges.map(edge => entitySliceMap[edge.target]); // context节点的话题
                topics.forEach(topic => {
                    if (node?.topicDist?.[topic]) node.efflux = topic;
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
                tip.show({name: getLegacyEdgeDisplayName(edge, graph)});
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide({name: getLegacyEdgeDisplayName(edge, graph)});
            });
            
        if (!edge.polygon?.points) {
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
                tip.show({name: getLegacyEdgeDisplayName(edge, graph)});
            })
            .on('click', function () {
                highlight_edge(edge.name);
                clickEdge(edge.name);
            })
            .on('mouseout', function () {
                mouseoutEdge(edge.name);
                tip.hide({name: getLegacyEdgeDisplayName(edge, graph)});
            });
    });

    let circle;
    let enlarge_ratio = {0: 1, 1: 1.5, 2: 2}[enlarge % 3]
    if (nodeShape == 0)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                const geometry = getSafeNodeGeometry(d);
                if (!geometry) return;
                let topics, radii;
                if (graph['sliceId'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['sliceId'], d.efflux].filter(t => t !== undefined);
                    radii = calculateNodeTopicRadii(d, topics, graph['sliceId']);
                }
                // 从外向内绘制同心圆
                for (let i = 0; i < topics.length; i++) {
                    const scale = getSafeRadiusScale(radii[i]);
                    if (scale <= 0) continue;
                    d3.select(this).append('ellipse')
                        .attr('cx', geometry.x)
                        .attr('cy', geometry.y)
                        .attr('rx', geometry.rx * scale * enlarge_ratio)
                        .attr('ry', geometry.ry * scale * enlarge_ratio)
                        .style("fill", sliceColor(topics[i]));
                }
            });
    if(nodeShape == 1)
        circle = matrixg.selectAll('paper').data(graph['nodes']).enter().append('g')
            .each(function(d) {
                const geometry = getSafeNodeGeometry(d);
                if (!geometry) return;
                let topics, radii;
                if (graph['sliceId'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['sliceId'], d.efflux].filter(t => t !== undefined);
                    radii = calculateNodeTopicRadii(d, topics, graph['sliceId']);
                }
                // 从外向内绘制同心矩形
                for (let i = 0; i < topics.length; i++) {
                    const scale = getSafeRadiusScale(radii[i]);
                    if (scale <= 0) continue;
                    d3.select(this).append('rect')
                        .attr('x', geometry.x - geometry.rx * scale * enlarge_ratio)
                        .attr('y', geometry.y - geometry.ry * scale * enlarge_ratio)
                        .attr('width', geometry.rx * 2 * scale * enlarge_ratio)
                        .attr('height', geometry.ry * 2 * scale * enlarge_ratio)
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
                const geometry = getSafeNodeGeometry(d);
                if (!geometry) return;
                let topics, radii;
                if (graph['sliceId'] == null) {
                    topics = [d.topic];
                    radii = [1];
                } else {
                    topics = [d.influx, graph['sliceId'], d.efflux].filter(t => t !== undefined);
                    radii = calculateNodeTopicRadii(d, topics, graph['sliceId']);
                }
                // 从外向内绘制同心多边形
                for (let i = 0; i < topics.length; i++) {
                    d3.select(this).append('polygon')
                        .attr('points', () => buildHexagonPointString(geometry, radii[i], enlarge_ratio))
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
            tip.show({name: getLegacyNodeDisplayName(d, graph)});
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
            tip.hide({name: getLegacyNodeDisplayName(d, graph)});
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


function isNull(value) {
    return value == undefined || value == null || value == 'null' || value == '' || value == NaN;
}

// 计算解决方案的成本
// 接受概率
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
        // Some legacy SVG nodes do not carry bound edge data; skip them when restoring styles.
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

function getLegacyNodeDisplayName(nodeOrId, graph=null) {
    const activeGraph = graph || getActiveScrollGraph();
    if (nodeOrId && typeof nodeOrId === 'object') {
        return nodeOrId.name || nodeOrId.label || nodeOrId.title || nodeOrId.id || '';
    }
    const id = String(nodeOrId ?? '');
    const node = activeGraph?.nodes?.find(item => String(item.id) === id);
    return node?.name || node?.label || node?.title || id;
}

function getLegacyEdgeDisplayName(edgeOrId, graph=null) {
    const activeGraph = graph || getActiveScrollGraph();
    const edge = edgeOrId && typeof edgeOrId === 'object'
        ? edgeOrId
        : activeGraph?.edges?.find(item => String(item.name || item.id) === String(edgeOrId));
    const key = String(edge?.name || edge?.id || edgeOrId || '');
    const source = edge?.source ?? key.split('->')[0];
    const target = edge?.target ?? key.split('->')[1];
    if (source != null && target != null) {
        return `${getLegacyNodeDisplayName(source, activeGraph)} -> ${getLegacyNodeDisplayName(target, activeGraph)}`;
    }
    return key;
}

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
    });
}

function resetStreamContextEdgeHighlight() {
    activeStreamContextEdgeKeys.forEach(key => mouseoutEdge(key));
    activeStreamContextEdgeKeys.clear();
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
                tip.show({name: getLegacyEdgeDisplayName(edge, graph)});
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
                tip.hide({name: getLegacyEdgeDisplayName(edge, graph)});
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

function op(key) {
    return function(value1, value2) {
        return value2[key] - value1[key];
    };
}

function stopPrismRotationLoop() {}
function stopRotateToAnimation() {}
function updateSider() {}
function render() {}

function highlightSlice(sliceId) {
    d3.selectAll('.entity-node').style('opacity', virtualOpacity);
    d3.selectAll(`.entity-slice-${sliceId}`).style('opacity', 1);
    d3.selectAll(`.context-polygon_${sliceId}`).style('fill-opacity', Math.min(1, topicOpacity * 2));
    d3.selectAll(`.context-ellipse_${sliceId}`).style('fill-opacity', Math.min(1, topicOpacity * 2));
}

function resetSliceHighlight(d) {
    d3.selectAll('.egroup').style('opacity', 1);
    d3.selectAll('.entity-node').style('opacity', 1);
    d3.selectAll('.context-polygon').style('fill-opacity', topicOpacity);
    d3.selectAll('.context-ellipse').style('fill-opacity', topicOpacity);
    if (tip) tip.hide(d);
    if (matrixg) {
        matrixg.selectAll('.epath')
            .style('stroke', item => item.color)
            .style('stroke-width', item => item.width)
            .style('opacity', 1);
        matrixg.selectAll('.epath-polygon')
            .style('fill', item => item.color)
            .style('opacity', 1);
    }
}

function updateOutlineColor(isKeyPaper, citationCount) {
    const outlineControl = typeof $ === 'function' ? $('#outline-color') : null;
    const outlineColorVal = outlineControl && typeof outlineControl.val === 'function' ? outlineControl.val() : '2';
    if (outlineColorVal == 0) return 'black';
    if (outlineColorVal == 1) return isKeyPaper >= 0.5 ? 'red' : 'black';
    if (citationCount < 50) return '#2271E0';
    if (citationCount < 100) return 'DarkOrange';
    return 'red';
}

function ensureLegacyRuntime() {
    if (!d3) throw new Error('Legacy layered Scroll requires d3 to be loaded before the module.');
    if (typeof d3.tip !== 'function') throw new Error('Legacy layered Scroll requires d3.tip.');
    if (!$) throw new Error('Legacy layered Scroll requires jQuery-compatible $.');
}

function ensureLegacyTip(selection = null) {
    ensureLegacyRuntime();
    if (!tip) {
        tip = d3.tip()
            .attr('class', 'd3-tip')
            .html(item => {
                if (item == null) return '';
                if (typeof item === 'string') return item;
                return item.name || item.label || item.title || item.id || '';
            });
    }
    if (selection && typeof selection.call === 'function') selection.call(tip);
    return tip;
}

function syncLegacyRuntime(options = {}) {
    if (options.viz) viz = options.viz;
    if (options.vizContext) vizContext = options.vizContext;
    if (options.fieldMeta) globalFieldMeta = options.fieldMeta || {};
    if (options.config) globalConfig = options.config;
    if (options.fields) globalFields = options.fields;
    if (options.data) authorData = options.data;
}

function syncLegacyConfig(config = {}, options = {}) {
    globalConfig = {...(globalConfig || {}), ...(config || {})};
    Object.keys(filterConfig).forEach(key => {
        if (globalConfig[key] != null) filterConfig[key] = globalConfig[key];
    });
    const nextYearGrid = Number(options.yearGrid ?? options.layerGridStep ?? globalConfig.yearGrid ?? globalConfig.timeGrid ?? filterConfig.yearGrid ?? yearGrid);
    if (Number.isFinite(nextYearGrid) && nextYearGrid > 0) {
        yearGrid = nextYearGrid;
        filterConfig.yearGrid = nextYearGrid;
    }
    setPrismVizScrollOptions(globalConfig || {});
}

export function initializeLegacyLayeredScroll(options = {}) {
    ensureLegacyRuntime();
    syncLegacyRuntime(options);
    syncLegacyConfig(options.config || {}, options);
    ensureLegacyTip();
}

function resolveComponentModels(componentScrollModel = {}, options = {}) {
    return options.componentModels
        || options.models
        || componentScrollModel.componentModels
        || componentScrollModel.models
        || (componentScrollModel.scrollBySliceId ? componentScrollModel : null);
}

function getComponentScrollSliceId(componentScrollModel = {}, options = {}) {
    const graph = componentScrollModel.graph || {};
    return options.sliceId
        ?? componentScrollModel.slice?.id
        ?? graph.slice?.id
        ?? graph.sliceId
        ?? componentScrollModel.sliceId
        ?? componentScrollModel.topicId
        ?? null;
}

function buildFieldMetaFromComponentModels(componentModels = {}) {
    const sliceInfoById = componentModels.displayInfo?.sliceInfoById || {};
    return (componentModels.slices || []).reduce((result, slice) => {
        const id = String(slice.id);
        const displayInfo = sliceInfoById[id] || {};
        result[id] = {
            ...displayInfo,
            shortName: slice.shortName || displayInfo.shortName || slice.name || id,
            chordName: slice.chordName || slice.shortName || displayInfo.shortName || slice.name || id,
            fullName: slice.fullName || displayInfo.fullName || displayInfo.description || slice.name || id,
            color: slice.color || displayInfo.color,
        };
        return result;
    }, {});
}

function buildFieldsFromSlices(slices = []) {
    return (slices || []).reduce((result, slice) => {
        const id = String(slice.id);
        result[id] = slice.name || slice.shortName || id;
        return result;
    }, {});
}

function normalizeLegacyComponentEntities(entities = [], schema = mergePrismVizSchema()) {
    return (entities || []).map(entity => normalizeEntity(entity, schema)).filter(entity => entity.id != null);
}

function normalizeLegacyComponentRelations(relations = [], schema = mergePrismVizSchema()) {
    return (relations || []).map(relation => normalizeRelation(relation, schema)).filter(relation => relation.source != null && relation.target != null);
}

function getLegacyEntityYear(entity, fallback = null) {
    const year = Number(entity?.year ?? entity?.time ?? fallback);
    return Number.isFinite(year) ? year : null;
}

function pickLegacyEntityTopic(entity = {}, activeSliceIds = new Set()) {
    const candidates = [entity.topic, ...Object.keys(entity.topicDist || {})]
        .filter(topic => !isNull(topic))
        .map(topic => String(topic))
        .filter(topic => activeSliceIds.has(topic));
    return candidates.length === 0 ? null : candidates[0];
}

function buildLegacyEntitySliceMap(entities = [], activeSliceIds = new Set()) {
    return Object.fromEntries((entities || []).map(entity => [
        String(entity.id),
        pickLegacyEntityTopic(entity, activeSliceIds),
    ]));
}

function buildLegacyComponentContext(componentGraph = {}, graph = {}, entityById = new Map(), modelMinYear = minYear, modelMaxYear = maxYear) {
    const contextEdges = {};
    const virtualEdges = [];
    const nodeIds = new Set((graph.nodes || []).map(node => String(node.id)));
    const G = new Graph();

    (graph.nodes || []).forEach(node => G.addNode(String(node.id), node));
    (graph.edges || []).forEach(edge => G.addEdge(String(edge.source), String(edge.target)));
    for (let year = modelMinYear; year <= modelMaxYear; year++) {
        G.addNode(`l${year}`, {year});
        G.addNode(`r${year}`, {year});
    }
    for (let year = modelMinYear; year < modelMaxYear; year++) {
        G.addEdge(`l${year}`, `l${year + 1}`);
        G.addEdge(`r${year}`, `r${year + 1}`);
    }

    normalizeLegacyComponentRelations(componentGraph.contextEdges || []).forEach(edge => {
        const source = String(edge.source);
        const target = String(edge.target);
        const sourceNode = entityById.get(source);
        const targetNode = entityById.get(target);
        if (!sourceNode || !targetNode) return;

        const sourceYear = getLegacyEntityYear(sourceNode, edge.year ?? edge.time);
        const targetYear = getLegacyEntityYear(targetNode, edge.year ?? edge.time);
        if (sourceYear == null || targetYear == null) return;

        const direction = edge.direction || (nodeIds.has(source) ? "out" : "in");
        if (direction === "out" && nodeIds.has(source)) {
            const key = `${source}->r${targetYear}`;
            if (!contextEdges[key]) contextEdges[key] = [];
            contextEdges[key].push(edge);
            G.addEdge(source, `r${targetYear}`);
        }
        if (direction === "in" && nodeIds.has(target)) {
            const key = `l${sourceYear}->${target}`;
            if (!contextEdges[key]) contextEdges[key] = [];
            contextEdges[key].push(edge);
            G.addEdge(`l${sourceYear}`, target);
        }
    });

    G.findConnectedComponents().forEach(component => {
        const node = G.findLastNodeInComponent(component);
        if (!node) return;
        const nodeYear = G.nodeProperties.get(node)?.year;
        if (nodeYear != null) virtualEdges.push(`${node}->r${nodeYear}`);
    });

    return {contextEdges, virtualEdges};
}

function buildLegacyGraphFromComponentScrollModel(componentScrollModel = {}, componentModels = {}, options = {}) {
    const schema = mergePrismVizSchema(options.schema || options.fieldMap || {});
    const componentGraph = componentScrollModel.graph || componentScrollModel;
    const sourceInput = componentModels.input || componentModels;
    const sourceSlices = sourceInput.slices || componentModels.slices || options.slices || [];
    const activeSlices = (componentModels.slices || sourceSlices || []).map(slice => ({...slice, id: String(slice.id)}));
    const activeSliceIds = new Set(activeSlices.map(slice => String(slice.id)));
    const fields = buildFieldsFromSlices(sourceSlices);
    const fieldMeta = {
        ...buildFieldMetaFromComponentModels(componentModels),
        ...(options.fieldMeta || {}),
    };
    const allEntities = normalizeLegacyComponentEntities(sourceInput.entities || sourceInput.nodes || componentModels.entities || [], schema);
    const allRelations = normalizeLegacyComponentRelations(sourceInput.relations || sourceInput.edges || componentModels.relations || [], schema);
    allEntities.forEach(entity => {
        entity.topic = pickLegacyEntityTopic(entity, activeSliceIds);
        entity.primarySliceId = entity.topic;
    });
    const entityById = new Map(allEntities.map(entity => [String(entity.id), entity]));
    const nodes = normalizeLegacyComponentEntities(componentGraph.nodes || componentGraph.entities || [], schema);
    nodes.forEach(node => {
        node.topic = pickLegacyEntityTopic(node, activeSliceIds);
        node.primarySliceId = node.topic;
    });
    const edges = normalizeLegacyComponentRelations(componentGraph.edges || componentGraph.relations || [], schema);
    const years = allEntities.map(entity => Number(entity.year)).filter(Number.isFinite);
    const modelMinYear = Number.isFinite(options.minYear) ? Number(options.minYear) : Math.min(...years);
    const modelMaxYear = Number.isFinite(options.maxYear) ? Number(options.maxYear) : Math.max(...years);
    const normalizedMinYear = Number.isFinite(modelMinYear) ? modelMinYear : 0;
    const normalizedMaxYear = Number.isFinite(modelMaxYear) ? modelMaxYear : normalizedMinYear;
    const sliceId = String(getComponentScrollSliceId(componentScrollModel, options));
    const scrollOptions = getPrismVizScrollOptions(options, {sliceId});
    const graph = {
        sliceId,
        layoutMode: scrollOptions.layoutMode,
        scrollRenderer: scrollOptions.scrollRenderer,
        scroll: scrollOptions,
        nodes,
        edges,
        paper_field: [],
    };

    const context = isLayeredScrollLayout(scrollOptions.layoutMode)
        ? buildLegacyComponentContext(componentGraph, graph, entityById, normalizedMinYear, normalizedMaxYear)
        : {contextEdges: {}, virtualEdges: []};
    graph.contextEdges = context.contextEdges;
    graph.virtualEdges = context.virtualEdges;
    graph.nodes.forEach(node => {
        const topic = node.topic;
        if (isNull(topic)) return;
        let item = graph.paper_field.find(field => String(field.id) === String(topic));
        if (!item) {
            item = {
                id: String(topic),
                num: 0,
                name: fields[String(topic)] || topic,
                shortName: fieldMeta[String(topic)]?.shortName || fields[String(topic)] || topic,
                chordName: fieldMeta[String(topic)]?.chordName || fieldMeta[String(topic)]?.shortName || fields[String(topic)] || topic,
                fullName: fieldMeta[String(topic)]?.fullName || fields[String(topic)] || topic,
                color: fieldMeta[String(topic)]?.color,
            };
            graph.paper_field.push(item);
        }
        item.num += 1;
    });

    return {
        graph: syncScrollGraphAliases(graph),
        allEntities,
        allRelations,
        slices: activeSlices,
        fields,
        fieldMeta,
        entitySliceMap: buildLegacyEntitySliceMap(allEntities, activeSliceIds),
        minYear: normalizedMinYear,
        maxYear: normalizedMaxYear,
    };
}

export function buildLegacyLayeredScrollModelFromComponentModel(componentScrollModel = {}, options = {}) {
    ensureLegacyRuntime();
    const componentModels = resolveComponentModels(componentScrollModel, options);
    const sliceId = getComponentScrollSliceId(componentScrollModel, options);
    if (!componentModels || sliceId == null) return null;
    const sourceInput = componentModels.input || componentModels;
    const sourceSlices = sourceInput.slices || componentModels.slices || options.slices || [];

    const config = {
        ...(sourceInput.config || {}),
        ...(componentModels.config || {}),
        ...(options.config || {}),
        layoutMode: options.layoutMode || options.config?.layoutMode || "layered-time",
        scrollRenderer: options.scrollRenderer || options.config?.scrollRenderer || "layered-scroll",
    };
    syncLegacyRuntime({
        data: componentModels,
        fields: sourceSlices,
        config,
        fieldMeta: {
            ...buildFieldMetaFromComponentModels(componentModels),
            ...(options.fieldMeta || {}),
        },
        ...options,
    });
    syncLegacyConfig(config, options);

    const legacyModel = buildLegacyGraphFromComponentScrollModel(componentScrollModel, componentModels, {
        ...options,
        layoutMode: config.layoutMode,
        scrollRenderer: config.scrollRenderer,
    });
    setActiveEntities(cloneJSON(legacyModel.allEntities));
    setActiveRelations(cloneJSON(legacyModel.allRelations));
    setActiveSlices(cloneJSON(legacyModel.slices));
    globalFields = legacyModel.fields;
    globalFieldMeta = legacyModel.fieldMeta;
    global_colors = cloneJSON(componentModels.colorMap || options.colorMap || {});
    minYear = legacyModel.minYear;
    maxYear = legacyModel.maxYear;
    setActiveEntitySliceMap(legacyModel.entitySliceMap);
    setActiveEntityTimeMap(Object.fromEntries(legacyModel.allEntities.map(entity => [String(entity.id), entity.year])));
    setActiveSliceGraphs({[String(sliceId)]: cloneJSON(legacyModel.graph)});

    const scrollOptions = getPrismVizScrollOptions(options, {sliceId});
    const slice = legacyModel.slices.find(item => String(item.id) === String(sliceId)) || componentScrollModel.slice || null;
    return {
        topicId: String(sliceId),
        sliceId: String(sliceId),
        topic: slice,
        slice,
        graph: cloneJSON(legacyModel.graph),
        layoutMode: scrollOptions.layoutMode,
        scrollRenderer: scrollOptions.scrollRenderer,
        scroll: scrollOptions,
    };
}

const legacyRenderScrollPanel = renderScrollPanel;
export function renderLegacyLayeredScrollPanel(elementId = getContainerId('scrollPanel'), scrollModel = null, options = {}) {
    ensureLegacyRuntime();
    syncLegacyConfig(options, options);
    ensureLegacyTip();
    if (!viz || !vizContext) {
        throw new Error('Legacy layered Scroll requires Viz and VizContext instances before rendering.');
    }
    const graph = legacyRenderScrollPanel(elementId, scrollModel, {
        ...options,
        activateVisType: options.activateVisType === true,
    });
    if (graph?.svg) ensureLegacyTip(graph.svg);
    return graph;
}

export const legacyLayeredScroll = {
    initialize: initializeLegacyLayeredScroll,
    buildScrollModelFromComponentModel: buildLegacyLayeredScrollModelFromComponentModel,
    renderScrollPanel: renderLegacyLayeredScrollPanel,
    renderScroll: renderLegacyLayeredScrollPanel,
    setScrollOptions: setPrismVizScrollOptions,
    getScrollOptions: getPrismVizScrollOptions,
};
