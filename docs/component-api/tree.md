# Tree 组件调用说明

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
