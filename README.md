# PJ1 Phase 1：CLI SVG 编辑器

本工程按照完整的 `phase_cli_1.md` 实现 TypeScript 命令行 SVG 编辑器。内置 rect、circle、ellipse、line、text、g 六类图形，使用面向对象图形层次与 Command 模式。`box` 是后续插件阶段的目标，本阶段按要求报 `unknown shape type`。

## 运行

需要 Node.js 22 或以上版本。在工程目录执行：

```sh
npm ci
npm run cli
```

首次克隆或解压后必须先运行 `npm ci`，依赖不随源码提交。macOS 用户完成安装后，也可以双击 [启动编辑器.command](启动编辑器.command) 打开终端编辑器。使用 `help` 查看完整命令；启动脚本和命令行均使用本机 Node.js。

命令示例：

```text
init 800 600
create g scene
create rect box 10 20 100 50 #4a90d9 in scene
create text label 20 50 "开始" in scene
move scene 30 0
scale box 2
tree
save diagram.svg
```

也可一次运行演示：

```sh
npm run cli -- --script examples/flowchart.commands
npm test
```

演示生成 [examples/flowchart.svg](examples/flowchart.svg)，可用浏览器打开。`--script` 在首条错误处停止；普通 REPL 会显示一行 `error:` 后继续读下一条命令。任何文档操作（init/read/save/canvas 修改）执行后，undo/redo 受屏障限制，直到下一条成功编辑。

## 提交与文档

- [doc/README.md](doc/README.md)：指定的架构方案、PlantUML 图、设计模式、依赖规则、变化点、AI 协作记录、一致性自查与质量保证。
- [doc/QA.md](doc/QA.md)：实际测试结果和按课程会话的验收记录。
- [doc/requirement-audit.md](doc/requirement-audit.md)：从最初摘要版本修订为完整作业要求的真实记录。
- [doc/acceptance.md](doc/acceptance.md)：课程要求、实现与验收证据的逐项对照。
- [doc/DEMO.md](doc/DEMO.md)：演示步骤与设计讲解提纲。
- [doc/architecture.puml](doc/architecture.puml) 与 [架构图](doc/architecture.svg)：可编辑的 PlantUML 源和由其渲染的 SVG。

2026-10-25 在 macOS / Node.js 23.9.0 上复核：严格编译与 57 项测试全部通过，覆盖课程命令会话、异常状态、完整撤销重做及 300 次混合编辑。新增只读文件保存拒绝、失败保存和失败导入的状态保护测试。历史版本已有 Linux、Windows、macOS 的 CI 通过记录；本次修订的远程结果请以 [GitHub 自动验收](https://github.com/zyy182/svg-/actions/workflows/ci.yml) 为准。

Git 历史保留真实阶段提交，远程仓库为 [zyy182/svg-](https://github.com/zyy182/svg-)。最终版使用 `final` 标签；提交前须确认远程 `main` 和 `final` 均指向交付版本，并确保老师能够访问私有仓库。原有提交历史不重写，提交包另含完整 Git bundle 备份。
