# React 调用说明

## 适用范围

当前提供 React wrapper，但组件内部渲染逻辑仍复用原生 JS 入口：

- `ReactTree` -> `renderTree`
- `ReactChord` -> `renderChord`
- `ReactPrism` -> `renderPrism`
- `ReactPrismSliceTags` -> `renderPrismSliceTags`
- `ReactScroll` -> `renderScroll`
- `ReactList` -> `renderList`

## 依赖

甲方 React 工程中需要已有：

```bash
npm install react react-dom
```

样式仍按组件 CSS 引入：

```js
import "../src/components/scroll/scroll.css";
import "../src/components/prism/prism.css";
import "../src/components/list/list.css";
```

如果项目不支持 CSS import，也可以在 HTML 中用 `<link rel="stylesheet">` 引入。

## Scroll 示例

```jsx
import {useMemo, useRef, useState} from "react";
import {ReactScroll} from "../src/components/scroll/Scroll.react.js";
import {ReactList} from "../src/components/list/List.react.js";
import {ReactPrismSliceTags} from "../src/components/prism/Prism.react.js";
import {capScrollModelBySliceWeights} from "../src/adapters/index.js";

export function ScrollPanel({model, sliceId}) {
  const scrollRef = useRef(null);
  const [detail, setDetail] = useState(null);

  const scrollData = useMemo(() => ({
    ...capScrollModelBySliceWeights(model, sliceId, 0),
    slices: model.slices,
    colorMap: model.colorMap,
    componentModels: model,
  }), [model, sliceId]);

  const options = useMemo(() => ({
    layoutMode: "free-graph",
    scrollRenderer: "graph",
    withContext: true,
    showStreams: true,
    componentModels: model,
    slices: model.slices,
    colorMap: model.colorMap,
  }), [model]);

  return (
    <>
      <ReactScroll
        data={scrollData}
        options={options}
        onReady={instance => {
          scrollRef.current = instance;
        }}
        onSelect={(item, context) => {
          setDetail({item, context});
        }}
      />
      <ReactPrismSliceTags
        slices={model.slices}
        options={{activeSliceId: sliceId, colorMap: model.colorMap}}
        onSelect={slice => console.log(slice.id)}
      />
      {detail && (
        <ReactList
          data={detail}
          options={{mode: "json", numberPrecision: 4}}
        />
      )}
    </>
  );
}
```

`ReactPrismSliceTags` 是独立的切片选择器，不属于 Scroll 内部。甲方如果需要 Scroll 下方这排标签，应和 demo 一样把它作为兄弟组件渲染，并把选中的 `sliceId` 传回 Scroll。

## demo

- reference React Tree：`instances/reference/demos-react/tree.html`
- reference React Chord：`instances/reference/demos-react/chord.html`
- reference React Prism：`instances/reference/demos-react/prism.html`
- reference React Scroll：`instances/reference/demos-react/scroll.html`
- reference React List：`instances/reference/demos-react/list.html`
- client React Tree：`instances/client/demos-react/tree.html`
- client React Chord：`instances/client/demos-react/chord.html`
- client React Prism：`instances/client/demos-react/prism.html`
- client React Scroll：`instances/client/demos-react/scroll.html`
- client React List：`instances/client/demos-react/list.html`

这些 demo 为浏览器直跑版本，通过 import map 从 CDN 加载 React；甲方项目中可直接使用本地 npm 依赖，不需要 import map。
