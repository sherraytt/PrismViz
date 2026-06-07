import React, {useEffect, useRef} from "react";
import {renderChord} from "./Chord.js";

export function ReactChord({
  data,
  options = {},
  onSelect,
  onSliceHover,
  onRelationHover,
  onReady,
  className = "gp-chord-host",
  style,
}) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return undefined;
    const instance = renderChord(ref.current, data, {
      ...options,
      onSelect,
      onSliceHover,
      onRelationHover,
    });
    onReady?.(instance);
    return () => {
      onReady?.(null);
      instance.destroy();
    };
  }, [data, options, onSelect, onSliceHover, onRelationHover, onReady]);

  return React.createElement("div", {ref, className, style});
}

export default ReactChord;
