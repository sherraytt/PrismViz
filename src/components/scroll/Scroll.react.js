import React, {useEffect, useRef} from "react";
import {renderScroll} from "./Scroll.js";

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

export function ReactScroll({
  data,
  options = {},
  onSelect,
  onNodeHover,
  onEdgeHover,
  onSegmentHover,
  onSegmentSelect,
  onStreamHover,
  onStreamSelect,
  onReady,
  className = "gp-scroll-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !data) return undefined;
    const mergedOptions = mergeCallbacks(options, {
      onSelect,
      onNodeHover,
      onEdgeHover,
      onSegmentHover,
      onSegmentSelect,
      onStreamHover,
      onStreamSelect,
    });
    const instance = renderScroll(ref.current, data, mergedOptions);
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [
    data,
    options,
    onSelect,
    onNodeHover,
    onEdgeHover,
    onSegmentHover,
    onSegmentSelect,
    onStreamHover,
    onStreamSelect,
    onReady,
  ]);

  return React.createElement("div", {ref, className, style});
}

export default ReactScroll;
