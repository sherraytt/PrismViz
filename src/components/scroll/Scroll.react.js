import React, {useEffect, useRef} from "react";
import {renderScroll} from "./Scroll.js";

export function ReactScroll({
  data,
  options = {},
  onSelect,
  onNodeHover,
  onEdgeHover,
  onSegmentHover,
  onSegmentSelect,
  onStreamSelect,
  onReady,
  className = "gp-scroll-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !data) return undefined;
    const instance = renderScroll(ref.current, data, {
      ...options,
      onSelect,
      onNodeHover,
      onEdgeHover,
      onSegmentHover,
      onSegmentSelect,
      onStreamSelect,
    });
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
    onStreamSelect,
    onReady,
  ]);

  return React.createElement("div", {ref, className, style});
}

export default ReactScroll;
