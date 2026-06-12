function resolveElement(container) {
  if (typeof container === "string") return document.querySelector(container);
  return container;
}

function normalizeRows(data = {}, options = {}) {
  const rows = Array.isArray(data)
    ? data
    : (data.rows || data.hierarchy || null);
  const sourceRows = rows || (data.slices || []).map(slice => ({
    id: slice.id,
    parentId: "-1",
    level: 0,
    name: slice.name || slice.shortName || slice.id,
    selectable: true,
    count: slice.size,
    color: slice.color,
    meta: slice.meta || {},
  }));
  const maxLevel = options.maxLevel;

  return sourceRows
    .map(row => ({
      id: String(row.id),
      parentId: row.parentId == null ? "-1" : String(row.parentId),
      level: Number.isFinite(Number(row.level)) ? Number(row.level) : 0,
      name: row.name || row.label || row.shortName || String(row.id),
      selectable: Boolean(row.selectable),
      count: row.count ?? row.size,
      color: row.color,
      sliceId: row.sliceId ?? row.rawSlice?.id,
      type: row.type || "slice",
      meta: row.meta || {},
      displayInfo: row.displayInfo || null,
      rawSlice: row.rawSlice || null,
      raw: row,
    }))
    .filter(row => maxLevel == null || row.level <= Number(maxLevel));
}

function moveTooltip(container, tooltip, event) {
  const rect = container.getBoundingClientRect();
  tooltip.style.left = `${event.clientX - rect.left + 12}px`;
  tooltip.style.top = `${event.clientY - rect.top + 12}px`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function createTooltipContent(row) {
  const count = row.count == null ? "" : `<span>${escapeHtml(row.count)}</span>`;
  return `<strong>${escapeHtml(row.name)}</strong>${count}`;
}

function buildTreeIndex(rows = []) {
  const childrenByParent = new Map();
  rows.forEach(row => {
    if (!childrenByParent.has(row.parentId)) childrenByParent.set(row.parentId, []);
    childrenByParent.get(row.parentId).push(row);
  });
  return childrenByParent;
}

function collectDescendantIds(childrenByParent, id, result = new Set()) {
  (childrenByParent.get(id) || []).forEach(child => {
    result.add(child.id);
    collectDescendantIds(childrenByParent, child.id, result);
  });
  return result;
}

function getVisibleRows(rows, childrenByParent, expandedIds) {
  const rowById = new Map(rows.map(row => [row.id, row]));
  const visible = [];
  const visit = row => {
    visible.push(row);
    if (!expandedIds.has(row.id)) return;
    (childrenByParent.get(row.id) || []).forEach(visit);
  };
  rows.forEach(row => {
    if (row.parentId === "-1" || !rowById.has(row.parentId)) visit(row);
  });
  return visible;
}

function createNode(row, options = {}, context = {}) {
  const item = document.createElement("button");
  const hasChildren = (context.childrenByParent?.get(row.id) || []).length > 0;
  const expanded = context.expandedIds?.has(row.id);
  const selected = context.selectedIds?.has(row.id)
    || (row.sliceId != null && context.selectedIds?.has(String(row.sliceId)))
    || (options.selectedId != null && String(options.selectedId) === String(row.id))
    || (options.selectedId != null && row.sliceId != null && String(options.selectedId) === String(row.sliceId));
  item.type = "button";
  item.className = [
    "gp-tree-node",
    `level-${row.level}`,
    hasChildren ? "has-children" : "",
    hasChildren && expanded ? "is-expanded" : "",
    row.selectable ? "is-selectable" : "is-group",
    selected ? "is-selected" : "",
  ].filter(Boolean).join(" ");
  item.dataset.nodeId = row.id;
  if (row.sliceId != null) item.dataset.sliceId = String(row.sliceId);
  item.style.setProperty("--gp-tree-indent", `${12 + row.level * (options.indentSize ?? 18)}px`);

  const toggle = document.createElement("span");
  toggle.className = "gp-tree-toggle";
  toggle.textContent = hasChildren ? (expanded ? "▾" : "▸") : "";
  item.appendChild(toggle);

  const swatch = document.createElement("span");
  swatch.className = row.color ? "gp-tree-swatch" : "gp-tree-swatch is-empty";
  if (row.color) swatch.style.background = row.color;
  item.appendChild(swatch);

  const label = document.createElement("span");
  label.className = "gp-tree-label";
  label.textContent = row.name;
  item.appendChild(label);

  if (options.showCount && row.count != null) {
    const count = document.createElement("span");
    count.className = "gp-tree-count";
    count.textContent = String(row.count);
    item.appendChild(count);
  }

  item.addEventListener("click", () => {
    if (hasChildren) {
      context.toggleRow?.(row.id);
    } else if (row.selectable && options.internalSelection !== false) {
      context.element?.querySelectorAll(".gp-tree-node.is-selected").forEach(node => node.classList.remove("is-selected"));
      context.selectedIds?.clear();
      context.selectedIds?.add(row.id);
      item.classList.add("is-selected");
    }
    if (typeof options.onSelect === "function") options.onSelect(row.raw || row);
  });
  item.addEventListener("mouseenter", event => {
    if (context.tooltip && options.tooltip !== false) {
      context.tooltip.innerHTML = createTooltipContent(row);
      context.tooltip.hidden = false;
      moveTooltip(context.element, context.tooltip, event);
    }
    if (typeof options.onHover === "function") options.onHover(row.raw || row);
  });
  item.addEventListener("mousemove", event => {
    if (context.tooltip && !context.tooltip.hidden) moveTooltip(context.element, context.tooltip, event);
  });
  item.addEventListener("mouseleave", () => {
    if (context.tooltip) context.tooltip.hidden = true;
    if (typeof options.onHover === "function") options.onHover(null);
  });

  return item;
}

export function renderTree(container, data = {}, options = {}) {
  const element = resolveElement(container);
  if (!element) {
    throw new Error("Tree container not found.");
  }

  const rows = normalizeRows(data, options);
  const rowById = new Map(rows.map(row => [row.id, row]));
  element.innerHTML = "";
  element.classList.add("gp-tree");

  if (rows.length === 0) {
    const empty = document.createElement("div");
    empty.className = "gp-tree-empty";
    empty.textContent = options.emptyText || "No data";
    element.appendChild(empty);
    return {destroy: () => { element.innerHTML = ""; }, rows};
  }

  const tooltip = document.createElement("div");
  tooltip.className = "gp-tree-tooltip";
  tooltip.hidden = true;
  const childrenByParent = buildTreeIndex(rows);
  const collapsedIds = new Set((options.collapsedIds || []).map(String));
  const expandedIds = new Set(
    rows
      .filter(row => (childrenByParent.get(row.id) || []).length > 0 && !collapsedIds.has(row.id))
      .map(row => row.id)
  );
  const context = {
    element,
    tooltip,
    childrenByParent,
    expandedIds,
    selectedIds: new Set(
      Array.isArray(options.selectedIds)
        ? options.selectedIds.map(String)
        : (options.selectedId == null ? [] : [String(options.selectedId)])
    ),
    toggleRow(id) {
      if (expandedIds.has(id)) {
        expandedIds.delete(id);
        collectDescendantIds(childrenByParent, id).forEach(childId => expandedIds.delete(childId));
      } else {
        expandedIds.add(id);
      }
      renderRows();
    },
  };

  function renderRows() {
    element.querySelectorAll(".gp-tree-node").forEach(node => node.remove());
    getVisibleRows(rows, childrenByParent, expandedIds)
      .forEach(row => element.insertBefore(createNode(row, options, context), tooltip));
  }

  function syncSelectionClasses() {
    element.querySelectorAll(".gp-tree-node").forEach(node => {
      const selected = context.selectedIds.has(String(node.dataset.nodeId))
        || (node.dataset.sliceId != null && context.selectedIds.has(String(node.dataset.sliceId)));
      node.classList.toggle("is-selected", selected);
    });
  }

  function rowMatchesId(row, id) {
    const activeId = String(id);
    return [
      row.id,
      row.sliceId,
      row.rawSlice?.id,
      row.raw?.id,
      row.raw?.sliceId,
      row.raw?.rawSlice?.id,
    ].some(value => value != null && String(value) === activeId);
  }

  function collectActiveIds(idOrIds) {
    const sourceIds = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
    const activeIds = new Set();
    sourceIds.filter(id => id != null).map(String).forEach(id => {
      activeIds.add(id);
      rows.forEach(row => {
        if (!rowMatchesId(row, id)) return;
        activeIds.add(row.id);
        if (row.sliceId != null) activeIds.add(String(row.sliceId));
        if (row.rawSlice?.id != null) activeIds.add(String(row.rawSlice.id));
        collectDescendantIds(childrenByParent, row.id).forEach(childId => activeIds.add(childId));
      });
    });
    return activeIds;
  }

  element.appendChild(tooltip);
  renderRows();

  return {
    rows,
    expandedIds,
    setActive(idOrIds) {
      context.selectedIds = collectActiveIds(idOrIds);
      syncSelectionClasses();
    },
    clearActive() {
      context.selectedIds.clear();
      syncSelectionClasses();
    },
    expandTo(id) {
      let row = rowById.get(String(id));
      while (row && row.parentId !== "-1") {
        expandedIds.add(row.parentId);
        row = rowById.get(row.parentId);
      }
      renderRows();
    },
    getRow(id) {
      return rowById.get(String(id)) || null;
    },
    update(nextData, nextOptions = {}) {
      return renderTree(element, nextData, {...options, ...nextOptions});
    },
    destroy() {
      element.innerHTML = "";
      element.classList.remove("gp-tree");
    },
  };
}

export const Tree = {
  render: renderTree,
};
