import React, {useEffect, useRef} from "react";
import {renderPrism, renderPrismSliceTags} from "./Prism.js";

function mergeCallbacks(options, callbacks) {
  const merged = {...options};
  Object.entries(callbacks).forEach(([key, propCallback]) => {
    const optionCallback = options?.[key];
    if (typeof optionCallback === "function" && typeof propCallback === "function") {
      merged[key] = optionCallback === propCallback
        ? optionCallback
        : (...args) => {
          optionCallback(...args);
          propCallback(...args);
        };
      return;
    }
    if (typeof propCallback === "function") {
      merged[key] = propCallback;
    } else if (typeof optionCallback === "function") {
      merged[key] = optionCallback;
    }
  });
  return merged;
}

export function ReactPrism({
  data,
  options = {},
  onActiveSliceChange,
  onTagClick,
  onTagHover,
  onReady,
  className = "gp-prism-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const mergedOptions = mergeCallbacks(options, {
      onActiveSliceChange,
      onTagClick,
      onTagHover,
    });
    const instance = renderPrism(ref.current, data, mergedOptions);
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [data, options, onActiveSliceChange, onTagClick, onTagHover, onReady]);

  return React.createElement("div", {ref, className, style});
}

export function ReactPrismSliceTags({
  slices = [],
  options = {},
  handlers = {},
  onSelect,
  onHover,
  onReady,
  className = "gp-prism-tags-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const instance = renderPrismSliceTags(ref.current, slices, options, {
      ...handlers,
      onSelect: onSelect || handlers.onSelect,
      onHover: onHover || handlers.onHover,
    });
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [slices, options, handlers, onSelect, onHover, onReady]);

  return React.createElement("div", {ref, className, style});
}

export default ReactPrism;
