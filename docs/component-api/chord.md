# Chord 组件调用说明

## 引入

```html
<link rel="stylesheet" href="../src/components/chord/chord.css">
<div id="chord-demo"></div>
```

```js
import {renderChord} from "../src/components/chord/Chord.js";
```

React 工程：

```js
import {ReactChord} from "../src/components/chord/Chord.react.js";
```

## 调用

```js
const instance = renderChord("#chord-demo", model.chord, {
  onSelect: item => {},
  onSliceHover: slice => {},
  onRelationHover: relation => {},
});
```

## 输入

```js
{
  slices: [{id, name, shortName, chordName, color, size}],
  matrix: [
    [0, 3, 2],
    [1, 0, 4]
  ]
}
```

`matrix[i][j]` 表示第 i 个 slice 指向第 j 个 slice 的聚合关系数。

## API

- `highlightSlice(sliceId)`
- `highlightRelation(sourceSliceId, targetSliceId)`
- `clearHighlight()`
- `update(data, options)`
- `destroy()`

## demo

- reference：`instances/reference/demos/chord.html`
- client：`instances/client/demos/chord.html`
- reference React：`instances/reference/demos-react/chord.html`
- client React：`instances/client/demos-react/chord.html`
