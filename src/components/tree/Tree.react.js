import React, {useEffect, useRef} from "react";
import {renderTree} from "./Tree.js";

export function ReactTree({
  data,
  options = {},
  onSelect,
  onHover,
  onReady,
  className = "gp-tree-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const instance = renderTree(ref.current, data, {
      ...options,
      onSelect,
      onHover,
    });
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [data, options, onSelect, onHover, onReady]);

  return React.createElement("div", {ref, className, style});
}

export default ReactTree;
