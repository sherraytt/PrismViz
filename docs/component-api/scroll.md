# Scroll 组件调用说明

## 引入

```html
<link rel="stylesheet" href="../src/components/scroll/scroll.css">
<div id="scroll-demo"></div>
```

```js
import {renderScroll} from "../src/components/scroll/Scroll.js";
```

React 工程：

```js
import {ReactScroll} from "../src/components/scroll/Scroll.react.js";
import {ReactPrismSliceTags} from "../src/components/prism/Prism.react.js";
```

## 调用

```js
const instance = renderScroll("#scroll-demo", model.scrollBySliceId[sliceId], {
  layoutMode: "free-graph",
  scrollRenderer: "graph",
  withContext: true,
  showStreams: true,
  componentModels: model,
  slices: model.slices,
  colorMap: model.colorMap,
  onSelect: (item, context) => {},
  onNodeHover: node => {},
  onEdgeHover: edge => {},
  onSegmentSelect: (segment, context) => {},
  onStreamSelect: (stream, context) => {},
});
```

React 调用：

```jsx
<ReactScroll
  data={model.scrollBySliceId[sliceId]}
  options={{
    layoutMode: "free-graph",
    scrollRenderer: "graph",
    withContext: true,
    showStreams: true,
    componentModels: model,
    slices: model.slices,
    colorMap: model.colorMap,
  }}
  onSelect={(item, context) => {}}
  onSegmentSelect={(segment, context) => {}}
  onStreamSelect={(stream, context) => {}}
  onReady={instance => {
    // instance.highlightEntity(entityId)
    // instance.destroy()
  }}
/>
```

下方 slice 标签不是 Scroll 内部 DOM，而是独立的切片选择器。原生调用使用 `renderPrismSliceTags()`，React 调用使用 `ReactPrismSliceTags`，并在 `onSelect` 中更新传给 Scroll 的 `sliceId`。

reference time layered：

```js
renderScroll("#scroll-demo", scrollModel, {
  engine: "prismviz",
  layoutMode: "layered-time",
  scrollRenderer: "layered-scroll",
  legacyLayeredApi,
  componentModels: model,
});
```

## 输入

```js
{
  slice: {id, name, shortName, color},
  graph: {
    nodes: [{id, label, primarySliceId, sliceWeights, time, impact}],
    edges: [{id, source, target, weight, type}],
    contextEdges: [{source, target, direction, sourceSliceId, targetSliceId, weight}]
  },
  slices: [{id, name, shortName, color}],
  colorMap: {[sliceId]: color}
}
```

## API

- `highlightEntity(entityId)`
- `highlightRelation(relation)`
- `highlightContextSlice(sliceId, direction)`
- `update(data, options)`
- `destroy()`

## demo

- reference：`instances/reference/demos/scroll.html`
- client：`instances/client/demos/scroll.html`
- reference React：`instances/reference/demos-react/scroll.html`
- client React：`instances/client/demos-react/scroll.html`
