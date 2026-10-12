# PJ1 Phase 1 质量验证记录

验证日期：2026-10-12。依据：用户提供的完整 `phase_cli_1.md`。本机环境：macOS，Node.js 24.19.0（Codex 工作区运行环境），TypeScript 5.9.3，saxes 6.0.0。对 TypeScript 版本使用 Node 原生测试；旧 Python 测试属于留在 Git 历史的早期摘要版本，不计入新版结果。

## 编译与自动化

```sh
npm ci
npm test
```

实际执行结果：严格 TypeScript 编译通过，54 项测试通过，0 失败。分布：领域 13、文件 11、Command/历史 11、CLI 11、静态架构 3、综合验收 5。CLI 部分包含完整课程会话的真实子进程；两个例示错误与成功反馈逐字校验。

GitHub Actions 使用锁文件安装依赖，分别执行 Linux + Node.js 22、Windows + Node.js 22、macOS + Node.js 24。三项任务均成功，首个已核验记录：[CI #1，提交 3fbdba7](https://github.com/zyy182/svg-/actions/runs/38248126444)。工作流位于 `.github/workflows/ci.yml`，后续推送自动重新运行；最终版本记录可在 [Actions](https://github.com/zyy182/svg-/actions/workflows/ci.yml) 查看。

架构测试从 TypeScript AST 读取实际 import 并检查允许的层级关系；逐文件确认生产类名、字段封装；检查没有 `switch` 或以 `shape.type` 决定行为的分支。这是对课程设计约束的可重复检查。

## 功能与错误路径

| 要求 | 结果与证据 |
| --- | --- |
| init/read/save/canvas | 四类文档命令测试；执行后撤销与重做被阻止。无参数 canvas 仅查询。 |
| 六类内置图形 | create 位置参数测试、各类几何与 SVG 往返；box/polygon 等返回 unknown shape type。 |
| 显式 ID / 外部自动补 ID | 大小写敏感与重复 ID 测试；对缺 ID 的 SVG 使用 rect1 等名称并打印 warning。 |
| move/scale | 各叶子修改实际几何；嵌套 Group 递归；非正缩放报指定错误，整个命令失败时回滚。 |
| group/ungroup/addto | 不连续及跨父容器收编、原相对顺序、父子环拒绝、根级解组拒绝和提升顺序。 |
| front/back | 调整同级绘制顺序；front 最后绘制，back 最先绘制。 |
| set | 仅规定白名单；文字以 text 元素内容保存；错误属性不改变状态。 |
| tree/show | 内联几何、Unicode 树枝、tree 子树与父容器。 |
| undo/redo | 每条编辑一个单元，完整序列逐步比较 SVG；新编辑清空 redo；失败操作不变更历史。 |
| REPL/脚本 | `svg>`、整行 `#` 注释、双引号中文、错误前缀 `error:`、脚本首错停止。 |
| 文件失败 | 缺文件/不可写、非法 UTF-8、非法 XML、重复 ID、原子替换失败时的原文件与临时文件状态。 |
| 长序列与回归 | 151 条成功编辑全部可撤销、重做；固定种子 300 次混合编辑检查结构、保存读回、失败原子性；整组删除及还原包含全部子孙。 |
| ID 与 XML 边界 | 中文等 Unicode XML 名称；合法注释/CDATA 内的 DOCTYPE 文字不会被误判；真实声明依然被拒绝。 |

首次 CLI 回归运行中发现两个实际问题：输入流关闭后仍尝试输出下一次提示符，以及脚本文件缺失时错误被打印两次。修复后重跑全部 45 项通过。此前 TypeScript 编译也发现过一个不安全的祖先类型断言，已改为容器接口。此处只记录实际出现的故障。

## 示例与限制

运行 `npm run cli -- --script examples/flowchart.commands` 会生成 examples/flowchart.svg：流程图包含 g、rect、text 和 line 共 8 个元素。运行时观察了嵌套树、节点 2 的移动/撤销及文字修改反馈；随后在浏览器中核对两个节点、文字与连线的实际呈现。macOS 启动脚本另用 init/create/show/quit 会话验证，可以正常进入编辑器并输出图形属性。

尚未执行课程隐藏测试。课程第 4.4 节 `box` 是后续插件化阶段目标，本阶段 `create box` 明确报错；普通 SVG g 上的 data-kind 标记可以保留，按普通组处理。资源上限是 5 MiB、10000 元素、128 层；默认历史不截断，内存随成功编辑数增长。SVG 复杂外部类型会被拒绝而不是静默丢失；解组删除容器自身的非继承合成效果（如 opacity），undo 恢复。代码分阶段提交，`main` 与 `final` 已推送至私有仓库；推送后校验远程引用。
