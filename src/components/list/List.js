import {formatValue} from "../../core/format.js";

function resolveElement(container) {
  if (typeof container === "string") return document.querySelector(container);
  return container;
}

function getByPath(object, path) {
  if (!path) return undefined;
  return String(path)
    .split(".")
    .reduce((current, part) => (current == null ? undefined : current[part]), object);
}

function normalizeListItems(data = {}, options = {}) {
  const source = Array.isArray(data) ? data : (data.items || []);
  return source.map(item => ({
    id: item.id,
    title: item.title
      ?? getByPath(item, options.titleField)
      ?? item.label
      ?? item.name
      ?? item.id,
    subtitle: item.subtitle
      ?? getByPath(item, options.subtitleField)
      ?? item.description
      ?? "",
    value: item.value
      ?? getByPath(item, options.valueField)
      ?? item.impact
      ?? item.weight,
    color: item.color,
    raw: item.raw || item,
  }));
}

function inferMode(data, options = {}) {
  if (options.mode && options.mode !== "auto") return options.mode;
  if (Array.isArray(data) || Array.isArray(data?.items)) return "list";
  if (Array.isArray(data?.rows)) return "table";
  return "json";
}

function clearElement(element) {
  element.innerHTML = "";
  element.classList.add("gp-list");
}

function renderEmpty(element, options = {}) {
  const empty = document.createElement("div");
  empty.className = "gp-list-empty";
  empty.textContent = options.emptyText || "No data";
  element.appendChild(empty);
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

function tooltipLine(label, value, options = {}) {
  if (value === undefined || value === null || value === "") return "";
  return `<span>${escapeHtml(label)}: ${escapeHtml(formatValue(value, options))}</span>`;
}

function createItemTooltip(item, options = {}) {
  return [
    `<strong>${escapeHtml(formatValue(item.title, options))}</strong>`,
    tooltipLine("value", item.value, options),
    item.subtitle ? `<span>${escapeHtml(formatValue(item.subtitle, options))}</span>` : "",
  ].join("");
}

function renderListMode(element, data, options = {}) {
  const items = normalizeListItems(data, options);
  if (items.length === 0) {
    renderEmpty(element, options);
    return items;
  }

  const fragment = document.createDocumentFragment();
  const tooltip = document.createElement("div");
  tooltip.className = "gp-list-tooltip";
  tooltip.hidden = true;
  items.forEach(item => {
    const row = document.createElement("button");
    row.type = "button";
    row.className = "gp-list-item";
    row.dataset.itemId = item.id == null ? "" : String(item.id);

    if (item.color) {
      const swatch = document.createElement("span");
      swatch.className = "gp-list-swatch";
      swatch.style.background = item.color;
      row.appendChild(swatch);
    }

    const content = document.createElement("span");
    content.className = "gp-list-content";

    const title = document.createElement("span");
    title.className = "gp-list-title";
    title.textContent = formatValue(item.title, options);
    content.appendChild(title);

    if (item.subtitle) {
      const subtitle = document.createElement("span");
      subtitle.className = "gp-list-subtitle";
      subtitle.textContent = formatValue(item.subtitle, options);
      content.appendChild(subtitle);
    }
    row.appendChild(content);

    if (item.value !== undefined && item.value !== null && item.value !== "") {
      const value = document.createElement("span");
      value.className = "gp-list-value";
      value.textContent = formatValue(item.value, options);
      row.appendChild(value);
    }

    row.addEventListener("click", () => {
      if (options.internalSelection !== false) {
        element.querySelectorAll(".gp-list-item.is-selected").forEach(node => node.classList.remove("is-selected"));
        row.classList.add("is-selected");
      }
      if (typeof options.onItemClick === "function") options.onItemClick(item.raw);
    });
    row.addEventListener("mouseenter", event => {
      if (options.tooltip !== false) {
        tooltip.innerHTML = createItemTooltip(item, options);
        tooltip.hidden = false;
        moveTooltip(element, tooltip, event);
      }
      if (typeof options.onItemHover === "function") options.onItemHover(item.raw);
    });
    row.addEventListener("mousemove", event => {
      if (!tooltip.hidden) moveTooltip(element, tooltip, event);
    });
    row.addEventListener("mouseleave", () => {
      tooltip.hidden = true;
      if (typeof options.onItemHover === "function") options.onItemHover(null);
    });

    fragment.appendChild(row);
  });
  element.appendChild(fragment);
  element.appendChild(tooltip);
  return items;
}

function objectToRows(value = {}) {
  return Object.entries(value).map(([key, cellValue]) => [key, cellValue]);
}

function isComplexValue(value) {
  return value !== null && typeof value === "object";
}

function summarizeComplexValue(value) {
  if (Array.isArray(value)) return `${value.length} items`;
  return `${Object.keys(value || {}).length} fields`;
}

function createJsonTree(value, options = {}, depth = 0) {
  const maxItems = options.maxArrayItems ?? 36;
  const defaultOpenDepth = options.defaultOpenDepth ?? 1;
  const root = document.createElement("div");
  root.className = "gp-list-json-tree";

  function appendValue(parent, key, cellValue, level) {
    const row = document.createElement("div");
    row.className = "gp-list-json-row";
    row.style.setProperty("--gp-list-json-level", String(level));

    const keyNode = document.createElement("span");
    keyNode.className = "gp-list-json-key";
    keyNode.textContent = key;
    row.appendChild(keyNode);

    if (!isComplexValue(cellValue)) {
      const valueNode = document.createElement("span");
      valueNode.className = `gp-list-json-value type-${typeof cellValue}`;
      valueNode.textContent = formatValue(cellValue, options);
      row.appendChild(valueNode);
      parent.appendChild(row);
      return;
    }

    const details = document.createElement("details");
    details.className = "gp-list-json-node";
    details.open = level < defaultOpenDepth;

    const summary = document.createElement("summary");
    summary.className = "gp-list-json-summary";

    const summaryKey = document.createElement("span");
    summaryKey.className = "gp-list-json-key";
    summaryKey.textContent = key;
    summary.appendChild(summaryKey);

    const summaryMeta = document.createElement("span");
    summaryMeta.className = "gp-list-json-meta";
    summaryMeta.textContent = summarizeComplexValue(cellValue);
    summary.appendChild(summaryMeta);

    details.appendChild(summary);
    appendEntries(details, cellValue, level + 1);
    parent.appendChild(details);
  }

  function appendEntries(parent, objectValue, level) {
    const entries = Array.isArray(objectValue)
      ? objectValue.slice(0, maxItems).map((item, index) => [`[${index}]`, item])
      : Object.entries(objectValue || {});
    entries.forEach(([key, cellValue]) => appendValue(parent, key, cellValue, level));
    if (Array.isArray(objectValue) && objectValue.length > maxItems) {
      const more = document.createElement("div");
      more.className = "gp-list-json-more";
      more.style.setProperty("--gp-list-json-level", String(level));
      more.textContent = `${objectValue.length - maxItems} more items`;
      parent.appendChild(more);
    }
  }

  if (isComplexValue(value)) appendEntries(root, value, depth);
  else root.textContent = formatValue(value, options);
  return root;
}

function renderTableMode(element, data, options = {}) {
  const rows = data.rows || objectToRows(data);
  if (rows.length === 0) {
    renderEmpty(element, options);
    return rows;
  }

  const table = document.createElement("table");
  table.className = "gp-list-table";
  const tbody = document.createElement("tbody");
  rows.forEach(row => {
    const [key, value] = Array.isArray(row) ? row : [row.key, row.value];
    const tr = document.createElement("tr");
    const th = document.createElement("th");
    th.textContent = formatValue(key, options);
    const td = document.createElement("td");

    if (isComplexValue(value)) {
      td.className = "gp-list-json-cell";
      td.appendChild(createJsonTree(value, options));
    } else {
      td.textContent = formatValue(value, options);
    }

    tr.appendChild(th);
    tr.appendChild(td);
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  element.appendChild(table);
  return rows;
}

function renderJsonMode(element, data, options = {}) {
  if (data == null) {
    renderEmpty(element, options);
    return data;
  }
  return renderTableMode(element, {rows: objectToRows(data)}, options);
}

export function renderList(container, data = null, options = {}) {
  const element = resolveElement(container);
  if (!element) {
    throw new Error("List container not found.");
  }

  clearElement(element);
  const mode = inferMode(data, options);
  let renderedData;

  if (mode === "list") renderedData = renderListMode(element, data || {}, options);
  else if (mode === "table") renderedData = renderTableMode(element, data || {}, options);
  else renderedData = renderJsonMode(element, data, options);

  return {
    element,
    mode,
    data: renderedData,
    showDetail(nextData, nextOptions = {}) {
      return renderList(element, nextData, {...options, ...nextOptions, mode: nextOptions.mode || "json"});
    },
    setActiveItem(itemId) {
      const activeId = itemId == null ? "" : String(itemId);
      element.querySelectorAll(".gp-list-item").forEach(node => {
        node.classList.toggle("is-selected", node.dataset.itemId === activeId);
      });
    },
    clearActive() {
      element.querySelectorAll(".gp-list-item.is-selected").forEach(node => node.classList.remove("is-selected"));
    },
    update(nextData, nextOptions = {}) {
      return renderList(element, nextData, {...options, ...nextOptions});
    },
    destroy() {
      element.innerHTML = "";
      element.classList.remove("gp-list");
    },
  };
}

export function createFloatingListPanel(options = {}) {
  const container = resolveElement(options.container) || document.body;
  const panel = document.createElement("section");
  panel.className = "gp-list-floating-panel";
  panel.hidden = true;
  panel.style.left = `${options.left ?? 28}px`;
  panel.style.top = `${options.top ?? 88}px`;

  const header = document.createElement("div");
  header.className = "gp-list-floating-header";
  const title = document.createElement("strong");
  title.textContent = options.title || "Detail";
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "Close");
  header.appendChild(title);
  header.appendChild(close);

  const body = document.createElement("div");
  body.className = "gp-list-floating-body";
  panel.appendChild(header);
  panel.appendChild(body);
  container.appendChild(panel);

  let listInstance = null;
  let dragging = false;
  let startX = 0;
  let startY = 0;
  let originX = 0;
  let originY = 0;

  function show(data, meta = {}) {
    title.textContent = meta.title || options.title || "Detail";
    if (listInstance) listInstance.destroy();
    listInstance = renderList(body, data, {
      mode: meta.mode || options.mode || "table",
      precision: options.precision ?? 4,
    });
    panel.hidden = false;
    panel.style.zIndex = String(options.zIndex ?? 40);
  }

  function hide() {
    panel.hidden = true;
  }

  function onPointerMove(event) {
    if (!dragging) return;
    panel.style.left = `${originX + event.clientX - startX}px`;
    panel.style.top = `${originY + event.clientY - startY}px`;
  }

  function onPointerUp() {
    dragging = false;
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
  }

  header.addEventListener("pointerdown", event => {
    if (event.target === close) return;
    dragging = true;
    startX = event.clientX;
    startY = event.clientY;
    originX = panel.offsetLeft;
    originY = panel.offsetTop;
    document.addEventListener("pointermove", onPointerMove);
    document.addEventListener("pointerup", onPointerUp);
  });
  close.addEventListener("click", hide);

  return {
    element: panel,
    show,
    hide,
    destroy() {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
      listInstance?.destroy();
      panel.remove();
    },
  };
}

export const List = {
  render: renderList,
  createFloatingPanel: createFloatingListPanel,
};
