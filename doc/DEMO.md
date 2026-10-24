# 演示与设计讲解提纲

以下是准备建议，不表示用户已经亲自完成演示。建议提交前在自己的终端运行一遍，并能指出对应的类和测试。

## 先确认安装和验收

安装 Node.js 22 或更新版本后，在工程目录运行：

```sh
npm ci
npm test
npm run cli -- --script examples/flowchart.commands
```

流程图脚本输出 8 个元素，保存 `examples/flowchart.svg`；用浏览器打开，可以看到两个节点及连线。macOS 用户安装本机 Node.js 并运行 `npm ci` 后，可双击根目录的 `启动编辑器.command` 进入交互编辑器。最新实测数量与环境见 [QA.md](QA.md)。

## 交互演示

运行 `npm run cli`，逐行输入。最后一次 undo 是刻意演示课程规定的 IO 屏障，须在交互模式中执行，不要把这段含预期错误的会话作为 `--script` 传入。

```text
read examples/flowchart.svg
tree
move node2 0 100
show process-label
undo
redo
undo
set process-label text "处理数据 v3"
undo
scale node2 0.5
undo
group cluster node1 node2
tree cluster
ungroup cluster
front node1
back node1
addto node1 arrow1
undo
delete node2
undo
save demo-review.svg
undo
quit
```

重点观察：移动 node2 时文字一起变化；一次 undo 还原整个操作；group/ungroup 以一个 Command 为单位；删除 node2 连同其子孙，undo 恢复完整结构；保存后的 undo 报 `error: undo not allowed after io command`。

## 可以用代码解释的设计问题

1. **为什么使用 Command？** CLI 只解析命令并构造对象。每条编辑 Command 保存前后 Memento，CommandHistory 负责顺序和 undo/redo；以后 GUI 能直接使用同一命令层。
2. **Composite 如何落地？** Group 和五种叶子继承 Shape，move/scale 使用多态；Group 只递归调用子节点，不判断它们的图形类型。矩形与文字组成节点，整组移动正好验证这点。
3. **为什么失败不会留下半成品？** EditCommand 在克隆文档上执行与验证，成功后才发布。组内有一个图形数值溢出，前面图形即使已被修改，也只发生在候选文档上。
4. **文件 IO 如何隔离？** application 只认识抽象 DocumentStore，SvgFileStore 在 infrastructure 实现它，main.ts 装配具体实现。domain 没有导入 Node 的文件系统或终端。
5. **快照的代价是什么？** 好处是删除树、跨容器分组和层级变更可可靠撤销；代价是每次保存完整文档，内存约为历史步数乘文档大小。没有以任意的 100 步限制替代课程语义；将来可换差量历史。
6. **如何新增类型或命令？** 当前分别在 ShapeFactory 和 CommandRegistry 的名称注册处添加。它们是方案中明示的待重构点；Phase 1 没有宣称实现运行时插件系统。
7. **AI 生成后发现了哪些问题？** 实际记录包含：摘要语言与全文冲突、祖先查找类型断言、CLI EOF/重复错误、ID 校验过严、历史额外截断、XML 注释误判等。可沿 Git 提交与回归测试核对，不能编造自己的审阅经历。

提交位置是私有仓库的 `final` 标签；老师需要能访问该私有仓库。课程未给出账号、邀请方式或提交入口时，应按老师的实际通知完成访问授权与课程平台提交。
