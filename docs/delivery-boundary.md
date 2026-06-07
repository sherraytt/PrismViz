# GeneticPrism 组件交付边界

本交付包只包含各组件自身功能、单组件 demo、reference/client 数据、调用说明和源系统参考示例。

## 包含

- `src/components/*`：Tree、Chord、Prism、Scroll、List 组件源码，包含原生 JS 调用入口和 React wrapper。
- `src/core/*`：通用数据归一化、建模、颜色和格式化工具。
- `src/adapters/*`：reference 旧学术数据和 client 产业数据的输入适配器；甲方调用时应优先使用这里的 adapter，而不是复制 demo-support。
- `src/detail/*`：List Panel 语义化详情 formatter。
- `instances/reference/data/*`
- `instances/client/data/*`
- reference/client 的五个单组件 demo：
  - `tree.html`
  - `chord.html`
  - `prism.html`
  - `scroll.html`
  - `list.html`
- reference/client 的五个 React 调用 demo：
  - `demos-react/tree.html`
  - `demos-react/chord.html`
  - `demos-react/prism.html`
  - `demos-react/scroll.html`
  - `demos-react/list.html`
- reference/client 的 demo 数据装配辅助：
  - `demo-support/reference-data.js`
  - `demo-support/client-data.js`
- `example/`：源系统交互示例，仅作为参考附录。
- `docs/`：组件 API、数据契约、交互规划和验收记录。

## 不包含

- `src/index.js`
- `src/coordinator/*`
- `src/components/*/*.react.jsx`
- `instances/reference/demos/integrated.*`
- `instances/reference/demos/native.html`
- `instances/client/demos/integrated.*`
- `instances/client/demos/combinations/*`

## 关键说明

- 单组件 demo 不依赖 `example/prismviz.js`。
- 本交付包同时提供原生 JavaScript 调用方式和 React wrapper；React demo 使用浏览器 import map 加载 React，甲方工程中可改为项目自身的 `react` / `react-dom` 依赖。
- Tree 当前只做 slice/topic 层级列表展示和选择入口；产业通系统已有较成熟的产业层级树实现，reference 原系统也没有复杂 Tree，因此本包没有对 Tree 做深入开发。
- `demo-support/*` 不是新增数据格式，只是 demo 加载本地 JSON 和展示少量 demo 指标的辅助代码；核心建模和详情整理已经放在 `src/adapters/*` / `src/detail/*`。
- `example/prismviz.js` 只保留为源系统交互效果参考，不作为新组件运行依赖。
- Graphviz runtime 当前仍使用 `example/viz-standalone.js` 和 `example/viz-context.js`，属于运行时资源；后续可以迁移到 `vendor/graphviz/`。
- 组件间联动尚未放入本交付包，后续按甲方确认的组件组合单独实现。
