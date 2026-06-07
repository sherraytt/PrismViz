import React, {useEffect, useRef} from "react";
import {renderPrism, renderPrismSliceTags} from "./Prism.js";

export function ReactPrism({
  data,
  options = {},
  onReady,
  className = "gp-prism-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const instance = renderPrism(ref.current, data, options);
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [data, options, onReady]);

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
