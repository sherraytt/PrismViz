# 数据输入格式

所有组件建议使用同一份归一化输入，通过 `buildComponentModels(rawInput)` 生成各组件模型。

```js
import {buildComponentModels} from "../src/core/index.js";

const model = buildComponentModels({
  normalized: true,
  slices,
  hierarchy,
  entities,
  relations,
  displayInfo,
  config,
});
```

## 顶层字段

- `slices`：切片定义。
- `hierarchy`：可选层级结构，主要用于 Tree。
- `entities`：点数据。
- `relations`：边数据，client 数据可在入口前聚合为一对点一条边。
- `displayInfo`：详情展示预处理信息，用于 List Panel。
- `config`：组件配置。

## slices

```js
{
  id: "slice_001",
  name: "Fabless设计",
  shortName: "Fabless",
  color: "#f7b267",
  size: 266
}
```

## hierarchy

```js
{
  id: "slice_001",
  parentId: null,
  level: 1,
  name: "Fabless设计",
  selectable: true,
  count: 266,
  color: "#f7b267"
}
```

## entities

```js
{
  id: "149048320",
  label: "秉诚能源控股集团有限公司",
  primarySliceId: "slice_25181",
  sliceWeights: {"slice_25181": 1},
  impact: 7000000,
  importance: 0.07,
  time: "2016",
  meta: {
    "法人": "李东强",
    "状态": "存续"
  }
}
```

## relations

```js
{
  id: "rel_inv_001",
  source: "484167",
  target: "48954474",
  type: "investment",
  weight: 0.8,
  time: "2024-07",
  meta: {
    "轮次id": "5"
  }
}
```

聚合关系可补充：

```js
{
  relationCount: 2,
  relationIds: ["rel_1", "rel_2"],
  relations: [{...}, {...}],
  types: ["investment", "shareholding"],
  typeCounts: {investment: 1, shareholding: 1}
}
```

## displayInfo

`displayInfo` 用来避免 List Panel 直接展示 raw/meta。

```js
{
  entityInfoById: {
    "149048320": {
      title: "秉诚能源控股集团有限公司",
      subtitle: "110100",
      metrics: {"注册资本(万元)": 7000000},
      attributes: {"法人": "李东强", "状态": "存续"}
    }
  },
  relationInfoById: {
    "rel_inv_001": {
      title: "投资关系",
      type: "investment",
      attributes: {"轮次id": "5"}
    }
  },
  sliceInfoById: {
    "slice_25181": {
      name: "半导体材料",
      shortName: "半导体材"
    }
  }
}
```

## Scroll 布局差异

- reference 可使用 `time layered` 和 `free graph`。
- client 当前只使用 `free graph`。
- 两类数据的 free graph 均通过 `renderScroll()` 进入同一套组件入口。

