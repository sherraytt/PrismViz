import {formatValue} from "../../core/format.js";

let chordInstanceCounter = 0;

function resolveElement(container) {
  if (typeof container === "string") return document.querySelector(container);
  return container;
}

function normalizeChordData(data = {}, options = {}) {
  const slices = data.slices || [];
  const matrix = data.matrix || data.sliceRelationMatrix || data.adjacentMatrix || [];
  const sliceByIndex = slices.map(slice => ({
    id: String(slice.id),
    name: slice.name || slice.shortName || String(slice.id),
    shortName: slice.shortName || slice.name || String(slice.id),
    chordName: slice.chordName || slice.shortName || slice.name || String(slice.id),
    color: slice.color,
    size: slice.size ?? slice.count ?? 0,
    raw: slice,
  }));
  const minWeight = Number(options.minWeight ?? 1);
  const relations = [];

  matrix.forEach((row, sourceIndex) => {
    row.forEach((weight, targetIndex) => {
      const value = Number(weight || 0);
      if (!options.showZero && value < minWeight) return;
      if (sourceIndex === targetIndex && options.showSelf !== true) return;
      const source = sliceByIndex[sourceIndex];
      const target = sliceByIndex[targetIndex];
      if (!source || !target) return;
      relations.push({
        source,
        target,
        weight: value,
        id: `${source.id}->${target.id}`,
      });
    });
  });

  relations.sort((a, b) => b.weight - a.weight);
  return {
    slices: sliceByIndex,
    matrix,
    relations,
  };
}

function sumRows(matrix = []) {
  return matrix.map(row => row.reduce((sum, value) => sum + Number(value || 0), 0));
}

function sumColumns(matrix = []) {
  const size = matrix.length;
  return matrix.map((_, columnIndex) =>
    matrix.reduce((sum, row) => sum + Number(row[columnIndex] || 0), 0)
  ).slice(0, size);
}

function relationStrength(matrix, sourceIndex, targetIndex) {
  return Number(matrix[sourceIndex]?.[targetIndex] || 0) + Number(matrix[targetIndex]?.[sourceIndex] || 0);
}

function relationEdges(matrix = []) {
  const edges = [];
  for (let sourceIndex = 0; sourceIndex < matrix.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < matrix.length; targetIndex += 1) {
      const weight = relationStrength(matrix, sourceIndex, targetIndex);
      if (weight > 0) edges.push({sourceIndex, targetIndex, weight});
    }
  }
  return edges;
}

function isBetweenCircular(value, start, end, size) {
  if (start < end) return value > start && value < end;
  return value > start || value < end;
}

function edgesCross(first, second, positions, size) {
  if (
    !positions.has(first.sourceIndex)
    || !positions.has(first.targetIndex)
    || !positions.has(second.sourceIndex)
    || !positions.has(second.targetIndex)
  ) {
    return false;
  }
  if (
    first.sourceIndex === second.sourceIndex
    || first.sourceIndex === second.targetIndex
    || first.targetIndex === second.sourceIndex
    || first.targetIndex === second.targetIndex
  ) {
    return false;
  }
  const firstStart = positions.get(first.sourceIndex);
  const firstEnd = positions.get(first.targetIndex);
  const secondStart = positions.get(second.sourceIndex);
  const secondEnd = positions.get(second.targetIndex);
  const secondStartInside = isBetweenCircular(secondStart, firstStart, firstEnd, size);
  const secondEndInside = isBetweenCircular(secondEnd, firstStart, firstEnd, size);
  return secondStartInside !== secondEndInside;
}

function scoreSliceOrder(order, edges) {
  const size = order.length;
  const positions = new Map(order.map((index, position) => [index, position]));
  let crossingScore = 0;
  let distanceScore = 0;

  edges.forEach(edge => {
    if (!positions.has(edge.sourceIndex) || !positions.has(edge.targetIndex)) return;
    const sourcePosition = positions.get(edge.sourceIndex);
    const targetPosition = positions.get(edge.targetIndex);
    const rawDistance = Math.abs(sourcePosition - targetPosition);
    distanceScore += edge.weight * Math.min(rawDistance, size - rawDistance);
  });

  for (let firstIndex = 0; firstIndex < edges.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < edges.length; secondIndex += 1) {
      if (edgesCross(edges[firstIndex], edges[secondIndex], positions, size)) {
        crossingScore += edges[firstIndex].weight * edges[secondIndex].weight;
      }
    }
  }

  return crossingScore * 100000 + distanceScore;
}

function rotateOrderToPrimary(order, priorities) {
  if (order.length <= 1) return order;
  let primaryPosition = 0;
  for (let position = 1; position < order.length; position += 1) {
    const current = order[position];
    const primary = order[primaryPosition];
    if (
      priorities[current] > priorities[primary]
      || (priorities[current] === priorities[primary] && current < primary)
    ) {
      primaryPosition = position;
    }
  }
  return order.slice(primaryPosition).concat(order.slice(0, primaryPosition));
}

function normalizeCustomSliceOrder(sliceOrder, slices) {
  if (!Array.isArray(sliceOrder)) return null;
  const indexById = new Map(slices.map((slice, index) => [String(slice.id), index]));
  const used = new Set();
  const order = [];
  sliceOrder.forEach(value => {
    const index = Number.isInteger(value) ? value : indexById.get(String(value));
    if (index == null || index < 0 || index >= slices.length || used.has(index)) return;
    used.add(index);
    order.push(index);
  });
  slices.forEach((_, index) => {
    if (!used.has(index)) order.push(index);
  });
  return order;
}

function buildSliceOrder(slices, matrix, outdegree, indegree, options = {}) {
  const customOrder = normalizeCustomSliceOrder(options.sliceOrder, slices);
  if (customOrder) return customOrder;
  if (options.sliceOrder === "input" || options.preserveSliceOrder === true) {
    return slices.map((_, index) => index);
  }

  const priorities = slices.map((slice, index) => {
    const dominantRelation = Math.max(outdegree[index] || 0, indegree[index] || 0);
    return dominantRelation || Number(slice.size || 0) || 1;
  });
  const edges = relationEdges(matrix);
  const remaining = slices
    .map((_, index) => index)
    .sort((a, b) => priorities[b] - priorities[a] || String(slices[a]?.id).localeCompare(String(slices[b]?.id)));
  if (remaining.length <= 2 || edges.length <= 1) return remaining;

  let order = [remaining.shift()];
  remaining.forEach(candidate => {
    let bestOrder = null;
    let bestScore = Infinity;
    for (let position = 0; position <= order.length; position += 1) {
      const nextOrder = order.slice(0, position).concat(candidate, order.slice(position));
      const score = scoreSliceOrder(nextOrder, edges);
      if (score < bestScore) {
        bestScore = score;
        bestOrder = nextOrder;
      }
    }
    order = bestOrder;
  });

  let bestScore = scoreSliceOrder(order, edges);
  let improved = true;
  for (let pass = 0; pass < 24 && improved; pass += 1) {
    improved = false;
    for (let from = 0; from < order.length; from += 1) {
      for (let to = 0; to < order.length; to += 1) {
        if (from === to) continue;
        const candidate = [...order];
        const [moved] = candidate.splice(from, 1);
        candidate.splice(to, 0, moved);
        const score = scoreSliceOrder(candidate, edges);
        if (score + 1e-6 < bestScore) {
          order = candidate;
          bestScore = score;
          improved = true;
        }
      }
    }
  }

  return rotateOrderToPrimary(order, priorities);
}

function polar(radius, angle) {
  return {
    x: Math.cos(angle - Math.PI / 2) * radius,
    y: Math.sin(angle - Math.PI / 2) * radius,
  };
}

function parseHexColor(color) {
  const value = String(color || "").trim();
  const shortHex = value.match(/^#([0-9a-f]{3})$/i);
  if (shortHex) {
    return shortHex[1].split("").map(channel => parseInt(channel + channel, 16));
  }
  const longHex = value.match(/^#([0-9a-f]{6})$/i);
  if (longHex) {
    return [
      parseInt(longHex[1].slice(0, 2), 16),
      parseInt(longHex[1].slice(2, 4), 16),
      parseInt(longHex[1].slice(4, 6), 16),
    ];
  }
  return null;
}

function mixHexColor(sourceColor, targetColor, ratio = 0.5) {
  const source = parseHexColor(sourceColor);
  const target = parseHexColor(targetColor);
  if (!source || !target) return sourceColor;
  const mixed = source.map((channel, index) => Math.round(channel + (target[index] - channel) * ratio));
  return `rgb(${mixed[0]}, ${mixed[1]}, ${mixed[2]})`;
}

function appendRibbonGradient(defs, id, ribbon, radius, namespace) {
  const sourcePoint = polar(radius, (ribbon.sourceStart + ribbon.sourceEnd) / 2);
  const targetPoint = polar(radius, (ribbon.targetStart + ribbon.targetEnd) / 2);
  const sourceColor = ribbon.source.slice.color || "#9bb";
  const targetColor = ribbon.target.slice.color || "#9bb";
  const middleColor = mixHexColor(sourceColor, targetColor, 0.5);
  const gradient = document.createElementNS(namespace, "linearGradient");
  gradient.setAttribute("id", id);
  gradient.setAttribute("gradientUnits", "userSpaceOnUse");
  gradient.setAttribute("x1", sourcePoint.x);
  gradient.setAttribute("y1", sourcePoint.y);
  gradient.setAttribute("x2", targetPoint.x);
  gradient.setAttribute("y2", targetPoint.y);

  [
    ["0%", sourceColor, 0.9],
    ["18%", sourceColor, 0.78],
    ["50%", middleColor, 0.76],
    ["82%", targetColor, 0.78],
    ["100%", targetColor, 0.9],
  ].forEach(([offset, color, opacity]) => {
    const stop = document.createElementNS(namespace, "stop");
    stop.setAttribute("offset", offset);
    stop.setAttribute("stop-color", color);
    stop.setAttribute("stop-opacity", opacity);
    gradient.appendChild(stop);
  });

  defs.appendChild(gradient);
}

function normalizeDegrees(degrees) {
  return ((degrees + 180) % 360 + 360) % 360 - 180;
}

function readableTangentLabelRotation(angle, offset = 0) {
  let degrees = normalizeDegrees(angle * 180 / Math.PI + offset);
  if (degrees > 90) degrees -= 180;
  if (degrees < -90) degrees += 180;
  return degrees;
}

function arcPath(innerRadius, outerRadius, startAngle, endAngle) {
  const largeArc = Math.abs(endAngle - startAngle) > Math.PI ? 1 : 0;
  const outerStart = polar(outerRadius, startAngle);
  const outerEnd = polar(outerRadius, endAngle);
  const innerEnd = polar(innerRadius, endAngle);
  const innerStart = polar(innerRadius, startAngle);

  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function ribbonPath(radius, sourceStart, sourceEnd, targetStart, targetEnd, curvePull = 0.26) {
  const sourceA = polar(radius, sourceStart);
  const sourceB = polar(radius, sourceEnd);
  const targetA = polar(radius, targetStart);
  const targetB = polar(radius, targetEnd);
  const sourceLarge = Math.abs(sourceEnd - sourceStart) > Math.PI ? 1 : 0;
  const targetLarge = Math.abs(targetEnd - targetStart) > Math.PI ? 1 : 0;

  return [
    `M ${sourceA.x} ${sourceA.y}`,
    `A ${radius} ${radius} 0 ${sourceLarge} 1 ${sourceB.x} ${sourceB.y}`,
    `C ${sourceB.x * curvePull} ${sourceB.y * curvePull} ${targetA.x * curvePull} ${targetA.y * curvePull} ${targetA.x} ${targetA.y}`,
    `A ${radius} ${radius} 0 ${targetLarge} 1 ${targetB.x} ${targetB.y}`,
    `C ${targetB.x * curvePull} ${targetB.y * curvePull} ${sourceA.x * curvePull} ${sourceA.y * curvePull} ${sourceA.x} ${sourceA.y}`,
    "Z",
  ].join(" ");
}

function buildChordGeometry(model, options = {}) {
  const {slices, matrix} = model;
  const ribbonWidthScale = Math.max(0.08, Math.min(1, Number(options.ribbonWidthScale ?? 1)));
  const minRibbonAngle = Math.max(0.002, Number(options.minRibbonAngle ?? 0.005));
  const outdegree = sumRows(matrix);
  const indegree = sumColumns(matrix);
  const order = buildSliceOrder(slices, matrix, outdegree, indegree, options);
  const weights = slices.map((slice, index) => {
    const relationWeight = Math.max(outdegree[index] || 0, indegree[index] || 0);
    const sizeWeight = Number(slice.size || 0);
    return Math.max(1, options.weightBy === "size" ? sizeWeight : relationWeight || sizeWeight);
  });
  const totalWeight = weights.reduce((sum, value) => sum + value, 0);
  const gap = Number(options.gap ?? 0.018);
  const totalGap = gap * slices.length;
  let cursor = 0;
  const angleByWeight = (2 * Math.PI - totalGap) / Math.max(totalWeight, 1);
  const arcsByIndex = new Array(slices.length);
  const arcs = order.map((sliceIndex, orderIndex) => {
    const weight = weights[sliceIndex];
    const startAngle = cursor;
    const endAngle = startAngle + weight * angleByWeight;
    cursor = endAngle + gap;
    const arc = {
      index: sliceIndex,
      orderIndex,
      slice: slices[sliceIndex],
      startAngle,
      endAngle,
      cursorStart: startAngle,
      cursorEnd: endAngle,
      out: outdegree[sliceIndex],
      in: indegree[sliceIndex],
      weight,
    };
    arcsByIndex[sliceIndex] = arc;
    return arc;
  });

  const ribbons = [];
  for (let sourceIndex = 0; sourceIndex < matrix.length; sourceIndex += 1) {
    for (let targetIndex = sourceIndex + 1; targetIndex < matrix.length; targetIndex += 1) {
      const forward = Number(matrix[sourceIndex]?.[targetIndex] || 0);
      const backward = Number(matrix[targetIndex]?.[sourceIndex] || 0);
      if (forward <= 0 && backward <= 0) continue;

      const sourceArc = arcsByIndex[sourceIndex];
      const targetArc = arcsByIndex[targetIndex];
      if (!sourceArc || !targetArc) continue;
      const sourceAvailable = sourceArc.endAngle - sourceArc.startAngle;
      const targetAvailable = targetArc.endAngle - targetArc.startAngle;
      const sourceSpan = sourceAvailable * (forward / Math.max(sourceArc.out, 1));
      const targetSpan = targetAvailable * (backward / Math.max(targetArc.out, 1));
      const fallbackSpan = Math.min(sourceAvailable, targetAvailable) * 0.08;
      const sourceAllocStart = sourceArc.cursorStart;
      const sourceAllocEnd = Math.min(
        sourceAllocStart + Math.max(sourceSpan, forward > 0 ? minRibbonAngle : fallbackSpan),
        sourceArc.endAngle
      );
      const targetAllocEnd = targetArc.cursorEnd;
      const targetAllocStart = Math.max(
        targetAllocEnd - Math.max(targetSpan, backward > 0 ? minRibbonAngle : fallbackSpan),
        targetArc.startAngle
      );
      const sourceAllocSpan = Math.max(sourceAllocEnd - sourceAllocStart, minRibbonAngle);
      const targetAllocSpan = Math.max(targetAllocEnd - targetAllocStart, minRibbonAngle);
      const sourceDrawSpan = Math.min(sourceAllocSpan, Math.max(minRibbonAngle, sourceAllocSpan * ribbonWidthScale));
      const targetDrawSpan = Math.min(targetAllocSpan, Math.max(minRibbonAngle, targetAllocSpan * ribbonWidthScale));
      const sourcePad = Math.max(0, (sourceAllocSpan - sourceDrawSpan) / 2);
      const targetPad = Math.max(0, (targetAllocSpan - targetDrawSpan) / 2);
      const sourceStart = sourceAllocStart + sourcePad;
      const sourceEnd = sourceAllocEnd - sourcePad;
      const targetStart = targetAllocStart + targetPad;
      const targetEnd = targetAllocEnd - targetPad;

      sourceArc.cursorStart = sourceAllocEnd;
      targetArc.cursorEnd = targetAllocStart;

      ribbons.push({
        id: `${sourceArc.slice.id}->${targetArc.slice.id}`,
        source: sourceArc,
        target: targetArc,
        forward,
        backward,
        sourceStart,
        sourceEnd,
        targetStart,
        targetEnd,
      });
    }
  }

  return {arcs, ribbons, outdegree, indegree};
}

function moveTooltip(container, tooltip, event) {
  const rect = container.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left + 14}px`;
  tooltip.style.top = `${event.clientY - rect.top + 14}px`;
}

function showTooltip(container, tooltip, event, html) {
  if (!tooltip) return;
  tooltip.innerHTML = html;
  tooltip.hidden = false;
  moveTooltip(container, tooltip, event);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function hideTooltip(tooltip) {
  if (tooltip) tooltip.hidden = true;
}

function ribbonHoverText(ribbon) {
  const source = ribbon.source.slice.chordName || ribbon.source.slice.shortName || ribbon.source.slice.name;
  const target = ribbon.target.slice.chordName || ribbon.target.slice.shortName || ribbon.target.slice.name;
  return `${source} (${formatValue(ribbon.forward)}) <-> ${target} (${formatValue(ribbon.backward)})`;
}

function resolveSvgViewport(element, options = {}) {
  const rect = element.getBoundingClientRect?.() || {};
  const fallbackSize = Number(options.size ?? 620);
  const width = Math.max(320, Number(options.width ?? options.viewportWidth ?? rect.width ?? element.clientWidth ?? fallbackSize));
  const height = Math.max(320, Number(options.height ?? options.viewportHeight ?? rect.height ?? element.clientHeight ?? fallbackSize));
  return {
    width,
    height,
    size: Math.min(width, height),
  };
}

function estimateLabelWidth(value, fontSize) {
  return Array.from(String(value || "")).reduce((sum, char) => (
    sum + (char.charCodeAt(0) > 255 ? 1 : 0.58)
  ), 0) * fontSize;
}

function installPanZoom(svg, content, options = {}) {
  let state = {
    scale: Number(options.scale ?? 1),
    x: Number(options.translateX ?? 0),
    y: Number(options.translateY ?? 0),
    dragging: false,
    startX: 0,
    startY: 0,
    originX: 0,
    originY: 0,
  };
  const minScale = Number(options.minScale ?? 0.45);
  const maxScale = Number(options.maxScale ?? 4);

  function applyTransform() {
    content.setAttribute("transform", `translate(${state.x} ${state.y}) scale(${state.scale})`);
  }

  function onWheel(event) {
    if (options.enableWheel === false) return;
    event.preventDefault();
    state.scale = Math.max(minScale, Math.min(maxScale, state.scale * 0.5 ** (event.deltaY / 900)));
    applyTransform();
  }

  function onPointerDown(event) {
    if (options.enableDrag === false || event.button !== 0) return;
    event.preventDefault();
    state.dragging = true;
    state.startX = event.clientX;
    state.startY = event.clientY;
    state.originX = state.x;
    state.originY = state.y;
    svg.classList.add("is-dragging");
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  }

  function onPointerMove(event) {
    if (!state.dragging) return;
    const box = svg.getBoundingClientRect();
    const viewBox = svg.viewBox.baseVal;
    const dx = (event.clientX - state.startX) / Math.max(box.width, 1) * viewBox.width;
    const dy = (event.clientY - state.startY) / Math.max(box.height, 1) * viewBox.height;
    state.x = state.originX + dx;
    state.y = state.originY + dy;
    applyTransform();
  }

  function onPointerUp() {
    state.dragging = false;
    svg.classList.remove("is-dragging");
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  }

  svg.addEventListener("wheel", onWheel, {passive: false});
  svg.addEventListener("pointerdown", onPointerDown);
  applyTransform();

  return {
    destroy() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      svg.removeEventListener("wheel", onWheel);
      svg.removeEventListener("pointerdown", onPointerDown);
    },
  };
}

function renderSvgMode(element, model, options = {}) {
  const viewport = resolveSvgViewport(element, options);
  const size = viewport.size;
  const arcThickness = Number(options.arcThickness ?? Math.max(12, Math.min(26, size * 0.03)));
  const labelFontSize = Number(options.labelFontSize ?? Math.max(13, Math.min(21, size * 0.037)));
  const maxLabelWidth = Math.max(0, ...model.slices.map(slice =>
    estimateLabelWidth(slice.chordName || slice.shortName || slice.name, labelFontSize)
  ));
  const labelTrackGap = Number(options.labelTrackGap ?? 5);
  const labelOuterBudget = labelTrackGap + labelFontSize * 1.05 + maxLabelWidth * 0.52 + 10;
  const minOuterRadius = Math.max(72, Math.min(112, size * 0.24));
  const safeOuterRadius = Math.max(minOuterRadius, size / 2 - labelOuterBudget);
  const outerRadius = Number(options.outerRadius ?? Math.min(size * 0.42, safeOuterRadius));
  const innerRadius = outerRadius - arcThickness;
  const ribbonRadius = innerRadius - Math.max(5, arcThickness * 0.14);
  const ribbonCurvePull = Math.max(0.08, Math.min(0.8, Number(options.ribbonCurvePull ?? 0.28)));
  const geometry = buildChordGeometry(model, options);
  const namespace = "http://www.w3.org/2000/svg";
  const gradientPrefix = `gp-chord-gradient-${chordInstanceCounter += 1}`;
  const tooltip = document.createElement("div");
  tooltip.className = "gp-chord-tooltip";
  tooltip.hidden = true;

  const svg = document.createElementNS(namespace, "svg");
  svg.setAttribute("class", "gp-chord-svg");
  svg.setAttribute("viewBox", `${-viewport.width / 2} ${-viewport.height / 2} ${viewport.width} ${viewport.height}`);
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Slice relation chord diagram");

  const defs = document.createElementNS(namespace, "defs");
  svg.appendChild(defs);
  const content = document.createElementNS(namespace, "g");
  content.setAttribute("class", "gp-chord-content");
  const ribbonsGroup = document.createElementNS(namespace, "g");
  ribbonsGroup.setAttribute("class", "gp-chord-ribbons");
  geometry.ribbons.forEach((ribbon, index) => {
    const gradientId = `${gradientPrefix}-${index}`;
    appendRibbonGradient(defs, gradientId, ribbon, ribbonRadius, namespace);
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("class", `gp-chord-ribbon source-${ribbon.source.index} target-${ribbon.target.index}`);
    path.setAttribute("d", ribbonPath(
      ribbonRadius,
      ribbon.sourceStart,
      ribbon.sourceEnd,
      ribbon.targetStart,
      ribbon.targetEnd,
      ribbonCurvePull
    ));
    path.setAttribute("fill", `url(#${gradientId})`);

    path.addEventListener("mouseenter", event => {
      svg.querySelectorAll(".gp-chord-ribbon, .gp-chord-arc").forEach(node => node.classList.add("is-dimmed"));
      path.classList.remove("is-dimmed");
      svg.querySelector(`.arc-${ribbon.source.index}`)?.classList.remove("is-dimmed");
      svg.querySelector(`.arc-${ribbon.target.index}`)?.classList.remove("is-dimmed");
      showTooltip(element, tooltip, event, escapeHtml(ribbonHoverText(ribbon)));
      if (typeof options.onRelationHover === "function") options.onRelationHover(ribbon);
    });
    path.addEventListener("mousemove", event => moveTooltip(element, tooltip, event));
    path.addEventListener("mouseleave", () => {
      svg.querySelectorAll(".is-dimmed").forEach(node => node.classList.remove("is-dimmed"));
      hideTooltip(tooltip);
      if (typeof options.onRelationHover === "function") options.onRelationHover(null);
    });
    path.addEventListener("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(ribbon);
    });

    ribbonsGroup.appendChild(path);
  });
  content.appendChild(ribbonsGroup);

  const arcsGroup = document.createElementNS(namespace, "g");
  arcsGroup.setAttribute("class", "gp-chord-arcs");
  geometry.arcs.forEach(arc => {
    const path = document.createElementNS(namespace, "path");
    path.setAttribute("class", `gp-chord-arc arc-${arc.index}`);
    path.setAttribute("d", arcPath(innerRadius, outerRadius, arc.startAngle, arc.endAngle));
    path.setAttribute("fill", arc.slice.color || "#999999");

    path.addEventListener("mouseenter", event => {
      svg.querySelectorAll(".gp-chord-ribbon, .gp-chord-arc").forEach(node => node.classList.add("is-dimmed"));
      path.classList.remove("is-dimmed");
      svg.querySelectorAll(`.source-${arc.index}, .target-${arc.index}`).forEach(node => node.classList.remove("is-dimmed"));
      showTooltip(element, tooltip, event, `<strong>${escapeHtml(arc.slice.name)}</strong><span>${escapeHtml(arc.slice.size)} entities</span><span>out ${escapeHtml(arc.out)} / in ${escapeHtml(arc.in)}</span>`);
      if (typeof options.onSliceHover === "function") options.onSliceHover(arc.slice.raw || arc.slice);
    });
    path.addEventListener("mousemove", event => moveTooltip(element, tooltip, event));
    path.addEventListener("mouseleave", () => {
      svg.querySelectorAll(".is-dimmed").forEach(node => node.classList.remove("is-dimmed"));
      hideTooltip(tooltip);
      if (typeof options.onSliceHover === "function") options.onSliceHover(null);
    });
    path.addEventListener("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(arc.slice.raw || arc.slice);
    });

    arcsGroup.appendChild(path);

    const angle = (arc.startAngle + arc.endAngle) / 2;
    const labelRadius = Number(options.labelRadius ?? outerRadius + labelTrackGap + labelFontSize * 0.62);
    const labelPoint = polar(labelRadius, angle);
    const text = document.createElementNS(namespace, "text");
    text.setAttribute("class", "gp-chord-label");
    text.setAttribute("x", labelPoint.x);
    text.setAttribute("y", labelPoint.y);
    text.setAttribute("text-anchor", "middle");
    text.setAttribute("dominant-baseline", "middle");
    text.setAttribute("font-size", labelFontSize);
    text.setAttribute(
      "transform",
      `rotate(${readableTangentLabelRotation(angle, Number(options.labelRotationOffset ?? 0))} ${labelPoint.x} ${labelPoint.y})`
    );
    text.textContent = arc.slice.chordName || arc.slice.shortName || arc.slice.name;
    arcsGroup.appendChild(text);
  });
  content.appendChild(arcsGroup);
  svg.appendChild(content);
  element.appendChild(svg);
  element.appendChild(tooltip);
  const zoom = installPanZoom(svg, content, options);

  return {
    geometry,
    destroy() {
      zoom.destroy();
    },
  };
}

function renderSliceList(element, slices = [], options = {}) {
  const section = document.createElement("section");
  section.className = "gp-chord-section";

  const title = document.createElement("h3");
  title.className = "gp-chord-title";
  title.textContent = options.sliceTitle || "Slices";
  section.appendChild(title);

  const list = document.createElement("div");
  list.className = "gp-chord-slice-list";
  slices.forEach(slice => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "gp-chord-slice";
    item.dataset.sliceId = slice.id;

    const swatch = document.createElement("span");
    swatch.className = "gp-chord-swatch";
    swatch.style.background = slice.color || "#999999";
    item.appendChild(swatch);

    const name = document.createElement("span");
    name.className = "gp-chord-slice-name";
    name.textContent = slice.chordName || slice.shortName || slice.name;
    item.appendChild(name);

    const size = document.createElement("span");
    size.className = "gp-chord-slice-size";
    size.textContent = formatValue(slice.size, options);
    item.appendChild(size);

    item.addEventListener("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(slice.raw || slice);
    });
    item.addEventListener("mouseenter", () => {
      if (typeof options.onSliceHover === "function") options.onSliceHover(slice.raw || slice);
    });
    item.addEventListener("mouseleave", () => {
      if (typeof options.onSliceHover === "function") options.onSliceHover(null);
    });

    list.appendChild(item);
  });
  section.appendChild(list);
  element.appendChild(section);
}

function renderRelationList(element, relations = [], options = {}) {
  const section = document.createElement("section");
  section.className = "gp-chord-section";

  const title = document.createElement("h3");
  title.className = "gp-chord-title";
  title.textContent = options.relationTitle || "Relations";
  section.appendChild(title);

  if (relations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "gp-chord-empty";
    empty.textContent = options.emptyText || "No relations";
    section.appendChild(empty);
    element.appendChild(section);
    return;
  }

  const list = document.createElement("div");
  list.className = "gp-chord-relation-list";
  const limit = options.limit == null ? relations.length : Number(options.limit);
  relations.slice(0, limit).forEach(relation => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "gp-chord-relation";
    item.dataset.relationId = relation.id;

    const source = document.createElement("span");
    source.className = "gp-chord-relation-source";
    source.textContent = relation.source.chordName || relation.source.shortName || relation.source.name;
    item.appendChild(source);

    const arrow = document.createElement("span");
    arrow.className = "gp-chord-relation-arrow";
    arrow.textContent = "->";
    item.appendChild(arrow);

    const target = document.createElement("span");
    target.className = "gp-chord-relation-target";
    target.textContent = relation.target.chordName || relation.target.shortName || relation.target.name;
    item.appendChild(target);

    const weight = document.createElement("span");
    weight.className = "gp-chord-relation-weight";
    weight.textContent = formatValue(relation.weight, options);
    item.appendChild(weight);

    item.addEventListener("click", () => {
      if (typeof options.onSelect === "function") options.onSelect(relation);
    });
    item.addEventListener("mouseenter", () => {
      if (typeof options.onRelationHover === "function") options.onRelationHover(relation);
    });
    item.addEventListener("mouseleave", () => {
      if (typeof options.onRelationHover === "function") options.onRelationHover(null);
    });

    list.appendChild(item);
  });
  section.appendChild(list);
  element.appendChild(section);
}

export function renderChord(container, data = {}, options = {}) {
  const element = resolveElement(container);
  if (!element) {
    throw new Error("Chord container not found.");
  }

  const model = normalizeChordData(data, options);
  element.innerHTML = "";
  element.classList.add("gp-chord");
  let renderer = null;

  if ((options.mode || "chord") === "list") {
    renderSliceList(element, model.slices, options);
    renderRelationList(element, model.relations, options);
  } else {
    renderer = renderSvgMode(element, model, options);
  }

  function sliceIndex(sliceId) {
    return model.slices.findIndex(slice => String(slice.id) === String(sliceId));
  }

  function clearHighlight() {
    element.querySelectorAll(".gp-chord-arc, .gp-chord-ribbon, .gp-chord-slice").forEach(node => {
      node.classList.remove("is-coordinator-active", "is-coordinator-relation", "is-coordinator-dimmed");
    });
  }

  function dimChordGraph() {
    element.querySelectorAll(".gp-chord-arc, .gp-chord-ribbon").forEach(node => {
      node.classList.add("is-coordinator-dimmed");
    });
  }

  function activateChordNodes(selector, className) {
    element.querySelectorAll(selector).forEach(node => {
      node.classList.remove("is-coordinator-dimmed");
      node.classList.add(className);
    });
  }

  function setActiveSlice(sliceId) {
    const activeId = String(sliceId);
    const index = sliceIndex(activeId);
    element.querySelectorAll(".gp-chord-arc, .gp-chord-ribbon, .gp-chord-slice").forEach(node => {
      node.classList.remove("is-selected", "is-coordinator-dimmed");
    });
    if (index < 0) return;
    dimChordGraph();
    element.querySelectorAll(".gp-chord-arc, .gp-chord-slice").forEach(node => {
      node.classList.toggle(
        "is-selected",
        node.classList.contains(`arc-${index}`) || node.dataset.sliceId === activeId
      );
      if (node.classList.contains("is-selected")) node.classList.remove("is-coordinator-dimmed");
    });
    activateChordNodes(`.gp-chord-ribbon.source-${index}, .gp-chord-ribbon.target-${index}`, "is-selected");
  }

  function highlightSlice(sliceId) {
    const activeId = String(sliceId);
    const index = sliceIndex(activeId);
    element.querySelectorAll(".gp-chord-arc.is-coordinator-active, .gp-chord-ribbon.is-coordinator-active, .gp-chord-slice.is-coordinator-active").forEach(node => {
      node.classList.remove("is-coordinator-active");
    });
    if (index < 0) return;
    dimChordGraph();
    element.querySelectorAll(".gp-chord-arc, .gp-chord-slice").forEach(node => {
      node.classList.toggle(
        "is-coordinator-active",
        node.classList.contains(`arc-${index}`) || node.dataset.sliceId === activeId
      );
      if (node.classList.contains("is-coordinator-active")) node.classList.remove("is-coordinator-dimmed");
    });
    activateChordNodes(`.gp-chord-ribbon.source-${index}, .gp-chord-ribbon.target-${index}`, "is-coordinator-active");
  }

  function highlightRelation(sourceSliceId, targetSliceId) {
    const sourceIndex = sliceIndex(sourceSliceId);
    const targetIndex = sliceIndex(targetSliceId);
    element.querySelectorAll(".gp-chord-arc.is-coordinator-relation, .gp-chord-ribbon.is-coordinator-relation, .gp-chord-slice.is-coordinator-relation").forEach(node => {
      node.classList.remove("is-coordinator-relation");
    });
    if (sourceIndex < 0 || targetIndex < 0) return;
    dimChordGraph();
    activateChordNodes(`.gp-chord-arc.arc-${sourceIndex}, .gp-chord-arc.arc-${targetIndex}`, "is-coordinator-relation");
    activateChordNodes([
      `.gp-chord-ribbon.source-${sourceIndex}.target-${targetIndex}`,
      `.gp-chord-ribbon.source-${targetIndex}.target-${sourceIndex}`,
    ].join(","), "is-coordinator-relation");
  }

  return {
    model,
    setActiveSlice,
    highlightSlice,
    highlightRelation,
    clearHighlight,
    update(nextData, nextOptions = {}) {
      return renderChord(element, nextData, {...options, ...nextOptions});
    },
    destroy() {
      renderer?.destroy?.();
      element.innerHTML = "";
      element.classList.remove("gp-chord");
    },
  };
}

export const Chord = {
  render: renderChord,
};
