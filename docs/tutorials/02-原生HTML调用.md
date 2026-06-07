# 原生 HTML 调用

本教程适合不使用 React 的页面。

## 最小调用步骤

1. 引入组件 CSS。
2. 准备一个容器。
3. 加载数据并构建组件模型。
4. 调用对应组件的 `renderXxx()`。

## Tree 示例

HTML：

```html
<link rel="stylesheet" href="./src/components/tree/tree.css">
<div id="tree" style="width: 960px; height: 640px;"></div>

<script type="module" src="./tree-demo.js"></script>
```

JS：

```js
import {buildComponentModels} from "./src/core/index.js";
import {renderTree} from "./src/components/tree/Tree.js";

const input = {
  normalized: true,
  slices,
  hierarchy,
  entities,
  relations,
  displayInfo,
  config,
};

const model = buildComponentModels(input);

renderTree("#tree", model.tree, {
  maxLevel: 2,
  showCount: true,
  onSelect: node => {
    console.log("selected tree node", node);
  },
});
```

## Chord 示例

```js
import {buildComponentModels} from "./src/core/index.js";
import {renderChord} from "./src/components/chord/Chord.js";

const model = buildComponentModels(input);

renderChord("#chord", model.chord, {
  onSelect: item => {
    console.log("selected chord item", item);
  },
});
```

## Prism 示例

```js
import {buildComponentModels} from "./src/core/index.js";
import {renderPrism} from "./src/components/prism/Prism.js";

const model = buildComponentModels(input);

renderPrism("#prism", model.prism, {
  onSelect: item => {
    console.log("selected prism item", item);
  },
});
```

## Scroll 示例

Scroll 一次显示一个 slice 的图数据。下方标签不是 Scroll 内部控件，如需要标签切换，需要额外调用 Prism 的标签组件。

```js
import {buildComponentModels} from "./src/core/index.js";
import {renderScroll} from "./src/components/scroll/Scroll.js";
import {renderPrismSliceTags} from "./src/components/prism/Prism.js";
import {renderList} from "./src/components/list/List.js";

const model = buildComponentModels(input);
let activeSliceId = model.slices[0].id;
let scrollInstance = null;

function renderActiveScroll() {
  scrollInstance?.destroy?.();

  scrollInstance = renderScroll("#scroll", model.scrollBySliceId[activeSliceId], {
    layoutMode: "free-graph",
    scrollRenderer: "graph",
    withContext: true,
    showStreams: true,
    componentModels: model,
    slices: model.slices,
    colorMap: model.colorMap,
    onSelect: (item, context) => {
      renderList("#detail", {item, context}, {
        mode: "json",
        numberPrecision: 4,
      });
    },
  });
}

renderPrismSliceTags("#slice-tags", model.slices, {
  activeSliceId,
  colorMap: model.colorMap,
  onSelect: slice => {
    activeSliceId = slice.id;
    renderActiveScroll();
  },
});

renderActiveScroll();
```

## List 示例

List 用于展示点击节点、边、slice 或 stream 后的详情。

```js
import {renderList} from "./src/components/list/List.js";

renderList("#detail", {
  type: "entity",
  title: "北京电科智芯科技有限公司",
  metrics: {"注册资本(万元)": 5000},
  attributes: {"法人": "张鹏", "状态": "存续"},
}, {
  mode: "json",
  numberPrecision: 4,
});
```

## 参考 demo

可以直接照着这些文件改：

```text
instances/reference/demos/
instances/client/demos/
```

