import {
  buildClientIndustryModels,
  capScrollModelBySliceWeights,
  detailRows,
  getDisplayInfo,
  DEFAULT_MAX_SLICE_NODES,
} from "../../../src/adapters/index.js";

const DEFAULT_BASE = "../data";

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

export async function loadClientDemoInput(baseUrl = DEFAULT_BASE) {
  const [
    slices,
    hierarchy,
    entities,
    relations,
    options,
    displayInfo,
  ] = await Promise.all([
    fetchJson(`${baseUrl}/slice_definitions.json`),
    fetchJson(`${baseUrl}/slice_hierarchy.json`),
    fetchJson(`${baseUrl}/entities.json`),
    fetchJson(`${baseUrl}/relations.json`),
    fetchJson(`${baseUrl}/component_options.json`),
    fetchJson(`${baseUrl}/display_info.json`),
  ]);

  return {
    slices,
    hierarchy,
    entities,
    relations,
    config: options,
    displayInfo,
  };
}

export async function buildSqModels(options = {}) {
  const raw = await loadClientDemoInput(options.baseUrl || DEFAULT_BASE);
  return buildClientIndustryModels(raw, options);
}

export function renderMetrics(container, rows = []) {
  const element = typeof container === "string" ? document.querySelector(container) : container;
  if (!element) return;
  element.innerHTML = "";
  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "sq-metric";
    row.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    element.appendChild(row);
  });
}

export {
  buildClientIndustryModels,
  capScrollModelBySliceWeights,
  detailRows,
  getDisplayInfo,
  DEFAULT_MAX_SLICE_NODES,
};
