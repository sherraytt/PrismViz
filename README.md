# GeneticPrism Components Deliverable

本目录是面向甲方的初步组件交付包。

## 内容

- `src/`：五个独立组件、通用数据建模、数据适配和详情展示辅助。
- `instances/reference/`：reference 数据、五个原生单组件 demo 和五个 React 调用 demo。
- `instances/client/`：client 数据、五个原生单组件 demo 和五个 React 调用 demo。
- `docs/`：组件调用说明、数据输入格式、交互规划、包边界和验收记录。
- `example/`：源系统交互示例，仅作为 legacy reference。

## 建议先看

- `docs/tutorials/00-先看这里.md`：交付包阅读顺序。
- `docs/tutorials/01-打开-demo.md`：最简单的 demo 运行方法。
- `docs/tutorials/02-原生HTML调用.md`：普通 HTML 页面调用教程。
- `docs/tutorials/03-React调用.md`：React 工程调用教程。
- `docs/tutorials/04-替换数据.md`：替换成甲方数据的步骤。
- `docs/pdf/`：上述文档和组件说明的 PDF 版本。

## 不包含

- integrated demo。
- combinations demo。
- 组件间 interaction coordinator。
- `src/index.js` 集成入口。

## 重要说明

单组件 demo 不依赖 `example/prismviz.js`。`example/prismviz.js` 只用于查看源系统交互效果，不作为新组件运行依赖。

如需体验 demo，可在本目录启动静态服务器：

```bash
python3 -m http.server 8765
```

然后打开：

- `http://127.0.0.1:8765/instances/reference/demos/tree.html`
- `http://127.0.0.1:8765/instances/client/demos/tree.html`

其余组件替换为 `chord.html`、`prism.html`、`scroll.html`、`list.html`。

React 调用 demo 位于：

- `http://127.0.0.1:8765/instances/reference/demos-react/tree.html`
- `http://127.0.0.1:8765/instances/client/demos-react/tree.html`

其余 React 组件同样替换为 `chord.html`、`prism.html`、`scroll.html`、`list.html`。
