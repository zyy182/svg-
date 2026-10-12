# 完整课程说明核对与修订记录

依据：用户在 2026-10-12 提供的本地 `phase_cli_1.md`。此前的 Python 版本只依据摘要实现；用户在阅读差异后明确确认改用 TypeScript 并符合全文。

| 原文要求 | 摘要版本的问题 | 新版修订目标 |
| --- | --- | --- |
| TypeScript、面向对象、一类一文件、字段封装 | Python + 通用 Node 数据结构 | 改为 TypeScript 抽象图形及六个具体类型 |
| 必须 Command 模式 | 函数分派配合文档快照 | 每条编辑构造成 Command 对象，execute/undo/redo 由历史管理器统一调用 |
| 不得到处按 tag 分派 | 通用属性表与 tag 判断 | 操作由图形多态实现，名称映射仅用于图形工厂与命令注册 |
| init/read/canvas/create 等指定协议 | new/open/add 及键值属性协议 | 按课程位置参数、in 尾缀与 set 三参数实现 |
| 未 init/read 时无文档 | 启动即有默认画布 | 会话初始空，统一 no document 错误 |
| 只内置 rect/circle/ellipse/line/text/g | 额外支持 polygon/polyline | 内核严格六种类型，其他类型报指定错误 |
| create 必须显式 ID | CLI 可以自动 n1/n2 | create/group 显式 ID；外部 SVG 使用标签名+序号补 ID 并警告 |
| move 增量修改位置；scale 同乘全部几何属性 | transform 矩阵变换 | 各图形直接修改几何属性；分组多态递归操作 |
| group 可跨父容器收编 | 要求同级连续 | 允许跨容器与不连续成员，保留原文档相对顺序；防祖先与子孙同时收编 |
| addto/front/back | 缺失 | 实现移入容器及同级绘制顺序调整 |
| ungroup 根级容器必须拒绝 | 允许解散根级组 | 校验父节点不是画布根；嵌套组在原位置提升子节点 |
| 文档类操作后 undo/redo 禁止 | save 保留可立即使用的历史 | init/read/save/canvas 修改后设历史屏障；下一条成功编辑恢复可用 |
| tree [id] 与 show id 指定可读格式 | 缩进树与 JSON | Unicode 树枝、内联几何属性、父节点与属性明细 |
| svg> 与 error: | 修改提示符与中文错误前缀 | 固定 svg>，错误单行 error:；使用课程规定的错误文本 |
| PlantUML 模块图、依赖规则与变化点 | 只有文本图和部分设计说明 | 增加 PlantUML 图源、依赖矩阵、扩展假设及两项一致性自查 |

修订按实际阶段提交，不更改旧提交内容与时间。原 Python 代码在迁移完成后从当前版本移除，可通过旧提交查看。最终文档以完整课程说明和新实现为准。

对于全文未完全定义的行为采用明确决策：跨父容器 group 放置在原父容器的最低公共祖先内，插入到最早成员所在分支的位置，组内按原文档遍历顺序排列；front 是最后绘制，back 是最先绘制。canvas 修改属于文档操作，不入编辑历史。历史屏障清空此前历史，避免撤销跨越保存或文档切换。

第一阶段实际结果：建立 TypeScript 六种图形与 Shape 抽象类，私有状态及多态 move/scale/set/clone；12 项领域测试通过，验证跨父容器分组、根级解组拒绝、addto 防环与 z-order。严格编译首次发现跨容器祖先查找的类型断言不安全，改用统一容器接口的 asShape 方法后通过。新增 PlantUML 架构图源。

第二阶段实际结果：将文件系统隔离到 SvgFileStore，由应用层 DocumentStore 端口反向注入；使用 saxes 解析 XML、工厂恢复多态图形。8 项文件测试通过，累计 20 项；验证标签名 ID 警告、原说明中的 transform、UTF-8、文本往返与原子替换失败清理。首次在 pnpm 链接目录生成 npm 锁文件时混入上游开发依赖，改为在干净临时目录生成，只保留实际 5 个依赖包的锁定条目。

第三阶段实际结果：为每条命令建立独立类。编辑 Command 保存前后文档 Memento，CommandHistory 调用 execute/undo/redo；文档与显示命令使用不可撤销基类。11 项应用测试通过，累计 31 项；覆盖完整编辑序列、失败事务、分支清空、所有 IO 屏障、显示类跳过历史、保存路径与指定 move 撤销反馈。
