# 验收记录

更新时间：2026-06-07

本文件记录 `deliverables/GeneticPrism-components/` 的交付前检查。

## 代码检查

- 通过：`node --check src/detail/detail.js`
- 通过：`node --check src/detail/selectors.js`
- 通过：`node --check src/components/tree/Tree.js`
- 通过：`node --check src/components/chord/Chord.js`
- 通过：`node --check src/components/prism/Prism.js`
- 通过：`node --check src/components/scroll/Scroll.js`
- 通过：`node --check src/components/scroll/legacyLayeredScroll.js`
- 通过：`node --check src/components/list/List.js`
- 通过：`node --check src/components/*/*.react.js`

## 单组件页面 smoke

- 通过：reference Tree
- 通过：reference Chord
- 通过：reference Prism
- 通过：reference Scroll
- 通过：reference List
- 通过：client Tree
- 通过：client Chord
- 通过：client Prism
- 通过：client Scroll
- 通过：client List
- 通过：reference/client 五个 React demo 均可渲染对应组件 DOM。

## 包边界检查

- 通过：交付目录无 `src/coordinator/*`。
- 通过：交付目录无 `src/index.js`。
- 通过：交付目录无 `src/components/*/*.react.jsx`。
- 通过：交付目录包含 `src/components/*/*.react.js`。
- 通过：交付目录无 `instances/*/demos/integrated.*`。
- 通过：React demo 位于 `instances/*/demos-react/{tree,chord,prism,scroll,list}.html`。
- 通过：demo 数据装配辅助位于 `instances/*/demo-support/`，不混放在 `demos/`。
- 通过：交付目录无 `instances/client/demos/combinations/*`。
- 通过：单组件 demo import `src/detail/*`，不 import `src/coordinator/*`。
- 通过：交付目录无内部阶段计划 `docs/plans/*`。
- 通过：交付目录无未被 demo 使用的合包数据 `instances/*/data/prismviz_data.json`，只保留拆分后的标准输入数据。

## 文档检查

- 通过：交付目录包含 `docs/tutorials/00-先看这里.md`。
- 通过：交付目录包含 `docs/tutorials/01-打开-demo.md`。
- 通过：交付目录包含 `docs/tutorials/02-原生HTML调用.md`。
- 通过：交付目录包含 `docs/tutorials/03-React调用.md`。
- 通过：交付目录包含 `docs/tutorials/04-替换数据.md`。
- 通过：交付目录包含 `docs/pdf/`，已为组件 API、数据契约、交付边界、交互规划、验收记录和傻瓜教程生成 PDF 版本。
- 通过：根目录 `README.md` 已列出教程入口和 PDF 文档位置。

## 备注

- Chromium smoke 中出现 `favicon.ico` 404，这是浏览器自动请求，不影响 demo。
- Prism / Scroll 仍加载 `example/viz-standalone.js`，Scroll 还加载 `example/viz-context.js`；这些是 Graphviz runtime，不是 `example/prismviz.js`。
