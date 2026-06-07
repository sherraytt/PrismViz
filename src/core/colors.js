export const DEFAULT_SLICE_PALETTE = [
  "#fdb462",
  "#b3de69",
  "#fccde5",
  "#8dd3c7",
  "#ffffb3",
  "#bebada",
  "#fb8072",
  "#80b1d3",
  "#bc80bd",
  "#ccebc5",
  "#a6cee3",
  "#33a02c",
  "#e31a1c",
  "#fdbf6f",
  "#8c510a",
  "#d73027",
];

function normalizeColor(value) {
  if (!value) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && value.hex) return value.hex;
  if (typeof value === "object" && typeof value.toString === "function") return value.toString();
  return null;
}

export function buildColorMap(slices = [], options = {}) {
  const palette = options.palette || DEFAULT_SLICE_PALETTE;
  const providedColorMap = options.colorMap || {};
  const colorMap = {};
  let paletteIndex = 0;

  slices.forEach(slice => {
    const id = String(slice.id);
    const explicitColor = normalizeColor(slice.color)
      || normalizeColor(slice.meta?.color)
      || normalizeColor(providedColorMap[id]);

    if (explicitColor) {
      colorMap[id] = explicitColor;
      return;
    }

    colorMap[id] = palette[paletteIndex % palette.length];
    paletteIndex += 1;
  });

  return colorMap;
}

export function applySliceColors(slices = [], options = {}) {
  const colorMap = buildColorMap(slices, options);
  return {
    colorMap,
    slices: slices.map(slice => ({
      ...slice,
      color: colorMap[String(slice.id)],
    })),
  };
}

export function getSliceColor(sliceId, colorMap = {}, fallback = "#999999") {
  if (sliceId === undefined || sliceId === null) return fallback;
  return colorMap[String(sliceId)] || fallback;
}
