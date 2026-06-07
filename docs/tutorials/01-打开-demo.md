# 打开 Demo

本教程用于快速确认交付包能正常运行。

## 第一步：进入交付包目录

```bash
cd GeneticPrism-components
```

目录里应该能看到：

```text
src
instances
docs
example
README.md
```

## 第二步：启动静态服务

不要直接双击 HTML 文件。浏览器直接打开本地文件时，ES Module 和 JSON 加载可能被安全策略拦截。

在交付包根目录执行：

```bash
python3 -m http.server 8765
```

看到类似下面的输出即可：

```text
Serving HTTP on 0.0.0.0 port 8765
```

## 第三步：打开 reference demo

在浏览器访问：

```text
http://127.0.0.1:8765/instances/reference/demos/tree.html
http://127.0.0.1:8765/instances/reference/demos/chord.html
http://127.0.0.1:8765/instances/reference/demos/prism.html
http://127.0.0.1:8765/instances/reference/demos/scroll.html
http://127.0.0.1:8765/instances/reference/demos/list.html
```

## 第四步：打开 client demo

在浏览器访问：

```text
http://127.0.0.1:8765/instances/client/demos/tree.html
http://127.0.0.1:8765/instances/client/demos/chord.html
http://127.0.0.1:8765/instances/client/demos/prism.html
http://127.0.0.1:8765/instances/client/demos/scroll.html
http://127.0.0.1:8765/instances/client/demos/list.html
```

## 第五步：打开 React demo

reference React demo：

```text
http://127.0.0.1:8765/instances/reference/demos-react/tree.html
http://127.0.0.1:8765/instances/reference/demos-react/chord.html
http://127.0.0.1:8765/instances/reference/demos-react/prism.html
http://127.0.0.1:8765/instances/reference/demos-react/scroll.html
http://127.0.0.1:8765/instances/reference/demos-react/list.html
```

client React demo：

```text
http://127.0.0.1:8765/instances/client/demos-react/tree.html
http://127.0.0.1:8765/instances/client/demos-react/chord.html
http://127.0.0.1:8765/instances/client/demos-react/prism.html
http://127.0.0.1:8765/instances/client/demos-react/scroll.html
http://127.0.0.1:8765/instances/client/demos-react/list.html
```

## 常见问题

如果页面空白，先打开浏览器开发者工具，看 Console 是否有文件路径错误。

如果提示端口被占用，换一个端口：

```bash
python3 -m http.server 8877
```

然后把 URL 中的 `8765` 改成 `8877`。

