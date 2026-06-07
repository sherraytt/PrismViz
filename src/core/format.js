export function formatNumber(value, precision = 4) {
  if (typeof value !== "number" || !Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return Number(value.toFixed(precision)).toString();
}

export function formatValue(value, options = {}) {
  const precision = options.numberPrecision ?? options.precision ?? 4;
  if (value === null || value === undefined || value === "") return options.emptyValue ?? "";
  if (typeof value === "number") return formatNumber(value, precision);
  if (typeof value === "boolean") return value ? "true" : "false";
  return String(value);
}
