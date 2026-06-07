# React 调用

本教程适合把组件接入甲方 React 工程。

## 第一步：复制交付目录

推荐先把整个 `GeneticPrism-components` 放到 React 工程根目录，形成类似结构：

```text
your-react-project/
  package.json
  src/
  GeneticPrism-components/
    src/
    instances/
    docs/
```

后续稳定后，可以再改造成 npm 包或内部组件库。

## 第二步：安装 React

甲方项目如果已经是 React 工程，通常不用再安装。新建测试工程时可执行：

```bash
npm install react react-dom
```

## 第三步：引入组件

以 Scroll 为例：

```jsx
import {useMemo, useRef, useState} from "react";
import {
  ReactScroll,
} from "../GeneticPrism-components/src/components/scroll/Scroll.react.js";
import {
  ReactPrismSliceTags,
} from "../GeneticPrism-components/src/components/prism/Prism.react.js";
import {
  ReactList,
} from "../GeneticPrism-components/src/components/list/List.react.js";

import "../GeneticPrism-components/src/components/scroll/scroll.css";
import "../GeneticPrism-components/src/components/prism/prism.css";
import "../GeneticPrism-components/src/components/list/list.css";
```

其他组件：

```jsx
import {ReactTree} from "../GeneticPrism-components/src/components/tree/Tree.react.js";
import {ReactChord} from "../GeneticPrism-components/src/components/chord/Chord.react.js";
import {ReactPrism} from "../GeneticPrism-components/src/components/prism/Prism.react.js";
import {ReactScroll} from "../GeneticPrism-components/src/components/scroll/Scroll.react.js";
import {ReactList} from "../GeneticPrism-components/src/components/list/List.react.js";
```

## 第四步：构建数据模型

```jsx
import {useMemo} from "react";
import {buildComponentModels} from "../GeneticPrism-components/src/core/index.js";

function useGeneticPrismModel(rawInput) {
  return useMemo(() => buildComponentModels({
    normalized: true,
    slices: rawInput.slices,
    hierarchy: rawInput.hierarchy,
    entities: rawInput.entities,
    relations: rawInput.relations,
    displayInfo: rawInput.displayInfo,
    config: rawInput.config,
  }), [rawInput]);
}
```

## 第五步：渲染 Scroll

```jsx
function ScrollDemo({model}) {
  const scrollRef = useRef(null);
  const [sliceId, setSliceId] = useState(model.slices[0]?.id);
  const [detail, setDetail] = useState(null);

  const scrollData = model.scrollBySliceId[sliceId];

  return (
    <div>
      <div style={{height: 640}}>
        <ReactScroll
          data={scrollData}
          options={{
            layoutMode: "free-graph",
            scrollRenderer: "graph",
            withContext: true,
            showStreams: true,
            componentModels: model,
            slices: model.slices,
            colorMap: model.colorMap,
          }}
          onReady={instance => {
            scrollRef.current = instance;
          }}
          onSelect={(item, context) => {
            setDetail({item, context});
          }}
        />
      </div>

      <ReactPrismSliceTags
        slices={model.slices}
        options={{
          activeSliceId: sliceId,
          colorMap: model.colorMap,
        }}
        onSelect={slice => {
          setSliceId(slice.id);
        }}
      />

      {detail && (
        <ReactList
          data={detail}
          options={{mode: "json", numberPrecision: 4}}
        />
      )}
    </div>
  );
}
```

## 第六步：查看可运行 demo

交付包已提供浏览器直跑 React demo：

```text
instances/reference/demos-react/
instances/client/demos-react/
```

这些 demo 使用 import map 从 CDN 加载 React，只用于演示调用方式。甲方正式 React 工程中建议使用本地 npm 依赖。

## 注意事项

- 组件容器必须有明确高度，尤其是 Scroll、Prism、Chord。
- Scroll 下方切片标签是独立组件，需要甲方自行决定是否渲染。
- 当前交付包不包含组件间自动联动，点击事件通过 `onSelect` 等回调交给甲方页面处理。

