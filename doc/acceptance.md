# 课程要求与验收证据

依据：用户提供的完整 `phase_cli_1.md`，最近核对日期 2026-10-25。这里对照可验证的要求，不预估老师的分数，也不把未知隐藏测试算作通过。

## 提交与设计

| 原文位置及要求 | 实现或提交证据 | 验收方式 |
| --- | --- | --- |
| 1.1：git 分步推进、远程仓库、最终 final | 私有仓库 `zyy182/svg-`；历史包含模型、文件适配、Command、CLI、文档与回归修复的独立提交 | `git log --oneline --graph`；推送后读取远程 main 与 final 的提交引用 |
| 1.2：doc/README.md 四类内容 | [项目文档](README.md) 含架构方案、过程记录、两项一致性自查、质量保证 | 逐节与全文核对 |
| 模块划分与 PlantUML 图 | domain/application/infrastructure/cli 和组合入口；[图源](architecture.puml) 与[实际渲染图](architecture.svg) | 源码 import 核对；浏览器检查渲染图 |
| Command 必须落地 | Command、EditCommand、CommandHistory 和各独立命令类 | commands.test.ts 的完整编辑、undo、redo、失败和屏障测试 |
| 依赖方向与变化点 | 项目文档给出依赖矩阵及新图形、新命令、历史、文件格式的变化假设 | architecture.test.ts 解析所有生产文件的 import |
| 2.1：TypeScript、OOP、一类一文件、封装 | 六个多态图形类；状态字段 private/protected；文件名与类名对应 | 严格 TypeScript 编译；静态架构检查及实际代码复核 |
| 名称分派仅两个位置 | CommandRegistry 和 ShapeFactory；在图与文档中明确标为后续重构点 | 生产代码无 switch；图形操作不依据 shape.type 分支 |
| 容器与叶子统一操作 | Shape 接口，Group 递归 move/scale；set 采用共享白名单，delete 删除树 | domain.test.ts、acceptance.test.ts 的嵌套节点、几何和整组删除检查 |

## 通用约定与全部 Phase 1 命令

| 要求 | 实现位置 | 验收证据 |
| --- | --- | --- |
| svg>、逐行输入、整行 # 注释、双引号 | cli/Cli、Tokenizer | cli.test.ts：提示符、引号、中文、颜色、空内容及 EOF |
| ID 显式、唯一、大小写敏感 | domain/ValueRules、Document；create/group 参数检查 | 大小写、重复 ID、Unicode 名称测试；[SVG 2 ID 规则](https://www.w3.org/TR/SVG/struct.html#Core.attrib) |
| 外部文件缺 ID 自动补齐并逐项 warning | infrastructure/SvgCodec | 后出现的显式 ID 不被自动 ID 占用；warning 文本逐字核对 |
| 浮点坐标、无穷/溢出校验 | ValueRules；各图形 geometry | 小数几何、非正缩放、非数值及组内部分溢出回滚 |
| error: 单行、失败不改变任何状态 | EditorError、Cli；EditCommand 副本发布 | 指定错误文本、文件路径/历史/文档不变；真实 CLI 继续读下一条 |
| init [w] [h] | InitCommand、DocumentSession | 默认 800×600、单参数默认高度、非法尺寸失败不影响状态 |
| read file.svg | ReadCommand、SvgFileStore、SvgCodec | 六类与嵌套 SVG 往返、UTF-8/BOM、缺文件、非法 XML、缺 ID 警告 |
| save [file.svg] | SaveCommand、SvgFileStore | 读入后无参数保存、路径包含中文/空格、写失败、只读目标拒绝、失败后路径与 redo 保留及原子替换清理 |
| canvas [w] [h] | CanvasCommand、Document | 无参数只查询；有参数修改并建立 IO 屏障 |
| create 六类、所有类型 in 尾缀 | CreateCommand、ShapeFactory、Arguments | 各类型位置参数、默认省略 fill/stroke、未知类型、父容器错误 |
| delete id | DeleteCommand、Document | 删除整个多层节点后所有子孙消失，undo 精确恢复结构和顺序 |
| move id dx dy | MoveCommand、各图形 move | 每种几何位置、嵌套节点文字随行；课程 move/undo/redo 反馈 |
| scale id factor | ScaleCommand、Shape/Group | 全部位置和尺寸同时缩放；文字内容与描边宽度不当作几何缩放 |
| set id attr value | SetCommand、各图形 set | 每类规定几何、公共呈现属性、text 内容、错误属性；SVG 文本子内容 |
| group newGid ids… | GroupCommand、Document | 非连续和跨父容器的成员；原文档顺序；祖先/子孙与重复选择拒绝 |
| ungroup gid | UngroupCommand、Document | 非根组原位置提升子节点；根组拒绝；样式/transform 与 undo 恢复 |
| addto gid id | AddToCommand、Group | 放到最后一个子节点，目标类型校验，防止父子环 |
| front/back id | FrontCommand、BackCommand | 同级绘制顺序变化，undo 恢复 |
| tree [id] | TreeCommand、Document | Unicode 树枝、内联几何、全文与子树 |
| show id | ShowCommand、Shape/Text | 属性明细、父容器与 text 内容 |
| help | HelpCommand、CommandRegistry | 列出全部命令、六类参数、in、set 白名单及历史约定 |
| undo/redo | CommandHistory、各 Command | 每条编辑一个单元；显示跳过；新编辑清 redo；151 条编辑完整往返 |
| 文档命令后禁止 undo/redo | Command.blocksHistory、CommandHistory | init/read/save/canvas 修改均检查；查询与失败不影响屏障；下次成功编辑解禁 |
| 第 6 节完整会话 | test/cli.test.ts 与 examples/other.svg | 真实子进程、指定成功反馈、两个预期错误、保存元素数量 |
| 第 6.1 节流程图 | examples/flowchart.commands、flowchart.svg | 八个元素，节点包含矩形与文字；实际浏览器预览 |

## 额外质量检查与边界

固定种子的 300 次混合编辑覆盖创建、变换、属性、分组、归属、层次和解组；每步验证树及 SVG 往返，错误后文档与历史保持原状，最后完整撤销并重做全部成功编辑。测试不依赖随机种子变化，可重复定位。

本次本机严格编译与 57 项测试通过。Linux + Node.js 22、Windows + Node.js 22、macOS + Node.js 24 的 CI 通过记录属于历史版本，本次新提交的远程 CI 需另行核验，记录见 [QA.md](QA.md)。测试命令中的文件通配符加双引号，交给 Node 解析，遵循 [Node 测试命令的可移植性说明](https://r2.nodejs.org/docs/latest-jod/api/test.html#running-tests-from-the-command-line)。

第 4.4 节 box 及第 6.1 节版本 B 明确属于后续阶段，当前 create box 报指定未知类型错误。外部 SVG 的 `<g data-kind="box">` 以普通 g 处理，并保留标记。本阶段不实现 path/image/use、动态插件加载、样式表及外部资源。单文件限制 5 MiB、10000 元素、128 层；撤销历史不默认截断。解组删除容器自身的非继承合成效果，撤销能恢复；导入 transform 保留，而编辑修改其内部几何坐标。上述边界已在项目文档公开。
