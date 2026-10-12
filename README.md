# CLI SVG 编辑器

PJ1 Phase 1：通过终端创建、读取、保存 SVG，编辑基础图形，管理分组，查看结构，并支持撤销与重做。使用 Python 3.9+ 标准库，无须安装第三方依赖。

## 运行

在工程根目录执行：

```sh
python3 main.py
# 或
python3 -m svg_editor
```

输入 `help` 查看命令，`help add` 查看各图形属性。示例：

```text
new 800 600
add rect id=box x=20 y=30 width=120 height=80 fill="#336699"
add circle id=ball cx=220 cy=80 r=40 fill=orange
group artwork box ball
move artwork 10 20
scale artwork 1.2
set ball fill=red
undo
redo
tree
save "my drawing.svg"
quit
```

命令包括 `new`、`open`、`save`、`add`、`move`、`scale`、`group`、`ungroup`、`delete`、`set`、`unset`、`tree`、`show`、`undo`、`redo`、`history`、`status`、`help`、`quit`，共 19 个。

新建、读取和退出前若有未保存修改，先保存，或明确使用 `--force` 放弃修改。移动与缩放作用于元素所在父坐标系；分组成员要求是连续同级元素，以保留绘制顺序。详细语义与兼容范围见 [项目文档](doc/README.md)。

## 演示与测试

```sh
python3 main.py --script examples/demo.commands
python3 main.py --file examples/demo.svg
python3 -m unittest discover -v
```

演示脚本会生成 [examples/demo.svg](examples/demo.svg)，可直接用浏览器查看。批处理遇错停止，返回非零退出码；只支持整行 `#` 注释。

## 提交材料

- [doc/README.md](doc/README.md)：架构设计、AI 协作记录、功能清单、一致性自查、质量保证与 Git 说明。
- [doc/QA.md](doc/QA.md)：实际执行的测试及验收记录。
- 本地 Git 历史按真实阶段提交；`final` 标签用于标记本地最终版本。
- 目标远程仓库：`https://github.com/zyy182/svg-`。远程推送需要 GitHub 认证，目前尚未完成。
