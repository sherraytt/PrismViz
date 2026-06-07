import {buildComponentModels} from "../../../src/core/index.js";

const BASE = "../data";

async function loadJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to load ${url}: ${response.status}`);
  return response.json();
}

export async function loadReferenceDemoInput(options = {}) {
  const baseUrl = options.baseUrl || BASE;
  const [
    slices,
    hierarchy,
    entities,
    relations,
    config,
    displayInfo,
  ] = await Promise.all([
    loadJson(`${baseUrl}/slice_definitions.json`),
    loadJson(`${baseUrl}/slice_hierarchy.json`),
    loadJson(`${baseUrl}/entities.json`),
    loadJson(`${baseUrl}/relations.json`),
    loadJson(`${baseUrl}/component_options.json`),
    loadJson(`${baseUrl}/display_info.json`),
  ]);

  return {
    normalized: true,
    slices,
    hierarchy,
    entities,
    relations,
    config: {
      ...config,
      ...(options.config || {}),
    },
    displayInfo,
  };
}

export async function loadReferenceDemoModels(options = {}) {
  return buildComponentModels(await loadReferenceDemoInput(options), options.model || options);
}
