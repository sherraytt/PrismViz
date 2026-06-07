# Prism 组件调用说明

## 引入

```html
<link rel="stylesheet" href="../src/components/prism/prism.css">
<div id="prism-demo"></div>
```

```js
import {renderPrism, renderPrismSliceTags} from "../src/components/prism/Prism.js";
```

React 工程：

```js
import {ReactPrism, ReactPrismSliceTags} from "../src/components/prism/Prism.react.js";
```

## 调用

```js
const instance = renderPrism("#prism-demo", model.prism, {
  faceLayout: "graphviz",
  activeSliceId: model.slices[0]?.id,
  autoRotate: false,
  onTagClick: slice => {},
  onTagHover: slice => {},
});
```

可单独绘制 slice 标签：

```js
renderPrismSliceTags("#tags", model.slices, {
  activeSliceId,
  colorMap: model.colorMap,
}, {
  onSelect: slice => {},
  onHover: slice => {},
});
```

## 输入

Prism 消费 `model.prism`：

```js
{
  slices: [{id, name, shortName, color, size}],
  sliceGraphs: {
    [sliceId]: {
      nodes: [{id, label, primarySliceId, impact}],
      edges: [{source, target, weight}]
    }
  },
  colorMap: {[sliceId]: color}
}
```

## API

- `setActiveSlice(sliceId)`
- `highlightSlice(sliceId)`
- `setRotation(enabled)`
- `update(data, options)`
- `destroy()`

## demo

- reference：`instances/reference/demos/prism.html`
- client：`instances/client/demos/prism.html`
- reference React：`instances/reference/demos-react/prism.html`
- client React：`instances/client/demos-react/prism.html`
