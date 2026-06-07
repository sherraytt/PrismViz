# Tree 组件调用说明

## 功能定位

Tree 当前用于展示 slice/topic 的简单层级列表，并作为选择 slice 的入口。产业通系统中已经有较成熟的产业层级树实现；reference 原系统也没有复杂 Tree 组件，因此本交付包未对 Tree 做深入开发，只保留配合演示和联动所需的列表显示、选中和回调能力。

## 引入

```html
<link rel="stylesheet" href="../src/components/tree/tree.css">
<div id="tree-demo"></div>
```

```js
import {renderTree} from "../src/components/tree/Tree.js";
```

React 工程：

```js
import {ReactTree} from "../src/components/tree/Tree.react.js";
```

## 调用

```js
const instance = renderTree("#tree-demo", model.tree, {
  maxLevel: 2,
  showCount: true,
  onSelect: node => {},
  onHover: node => {},
});
```

## 输入

Tree 消费 `model.tree`，也可直接传入：

```js
{
  rows: [
    {id, parentId, level, name, count, color, rawSlice}
  ]
}
```

## API

- `update(data, options)`
- `destroy()`

## demo

- reference：`instances/reference/demos/tree.html`
- client：`instances/client/demos/tree.html`
- reference React：`instances/reference/demos-react/tree.html`
- client React：`instances/client/demos-react/tree.html`
