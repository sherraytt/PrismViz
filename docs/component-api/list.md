# List 组件调用说明

## 引入

```html
<link rel="stylesheet" href="../src/components/list/list.css">
<div id="list-demo"></div>
```

```js
import {renderList} from "../src/components/list/List.js";
import {createDetailRows} from "../src/detail/detail.js";
```

React 工程：

```js
import {ReactList} from "../src/components/list/List.react.js";
```

## 调用

列表模式：

```js
const instance = renderList("#list-demo", model.list, {
  mode: "list",
  titleField: "label",
  valueField: "impact",
  onItemClick: item => {},
});
```

详情模式：

```js
renderList("#detail", createDetailRows(model, entity, {type: "node"}), {
  mode: "json",
  numberPrecision: 4,
});
```

## 输入

```js
{
  items: [
    {id, title, subtitle, value, color, raw}
  ]
}
```

也可以直接传任意对象作为详情数据。

## API

- `update(data, options)`
- `showDetail(data, options)`
- `destroy()`

## demo

- reference：`instances/reference/demos/list.html`
- client：`instances/client/demos/list.html`
- reference React：`instances/reference/demos-react/list.html`
- client React：`instances/client/demos-react/list.html`
