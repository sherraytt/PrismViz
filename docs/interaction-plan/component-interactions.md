# 组件间交互规划

本交付包不实现组件间交互，只保留规划。后续甲方确认需要哪些组件组合后，再按挂载组件集合启用对应联动。

## 原则

- 只调用一个组件：只保留该组件内部 hover/click/highlight。
- 调用两个组件：只启用这两个组件之间的同步。
- 调用多个组件：按实际挂载集合动态启用，不要求所有组件都存在。
- List Panel 可作为可选详情面板，接收任意组件点击结果。

## 建议事件

- `slice:select`
- `slice:hover`
- `entity:select`
- `entity:hover`
- `relation:select`
- `relation:hover`
- `contextSlice:select`
- `contextSlice:hover`
- `layout:change`

## 建议联动

- Tree 选择 slice：更新 Chord 高亮、Prism active face、Scroll 当前 slice。
- Chord 选择 slice relation：高亮相关 slice，对 Scroll 传入 context slice。
- Prism 选择 face/tag：更新当前 slice，并驱动 Scroll 切换。
- Scroll 选择 node：List Panel 展示 entity detail。
- Scroll 选择 edge：List Panel 展示 relation detail。
- Scroll stream/segment hover：只在 Scroll 内部高亮；如挂载 Chord，可同步 context slice。

## 后续实现方式

- 新增独立 interaction coordinator。
- coordinator 根据挂载组件注册表决定启用哪些 action。
- 组件本身不直接 import 其他组件。
- 调用方可以只挂载 Tree + Scroll、Prism + List 或全组件。

