import React, {useEffect, useRef} from "react";
import {renderList} from "./List.js";

export function ReactList({
  data,
  options = {},
  onItemClick,
  onItemHover,
  onReady,
  className = "gp-list-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const instance = renderList(ref.current, data, {
      ...options,
      onItemClick,
      onItemHover,
    });
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [data, options, onItemClick, onItemHover, onReady]);

  return React.createElement("div", {ref, className, style});
}

export default ReactList;
