"""Command parsing and terminal interaction, separate from document editing."""

import argparse
import json
from pathlib import Path
import shlex
import sys

from . import __version__
from .editor import Editor
from .errors import EditorError
from .model import SHAPES
from .storage import serialize_svg

USAGE = {
    "new": "new [宽 高] [--force]                 新建画布，默认 800 × 600",
    "open": 'open "文件.svg" [--force]             读取文档并清空编辑历史',
    "save": 'save ["文件.svg"]                     保存；首次保存需要路径',
    "add": "add 类型 [id=ID] [parent=组ID] 属性=值 ...  创建图形，自动 ID 为 n1、n2…",
    "move": "move ID dx dy                         在父坐标系中移动",
    "scale": "scale ID sx [sy [cx cy]]              在父坐标系中缩放；默认 sy=sx，中心 (0,0)",
    "group": "group 组ID 元素ID ...                 将连续同级元素分组，保留绘制顺序",
    "ungroup": "ungroup 组ID                         解除分组，保留变换和继承属性",
    "delete": "delete ID                           删除元素及其子树",
    "set": "set ID 属性=值 ...                     修改属性；text= 修改文本",
    "unset": "unset ID 属性 ...                     删除可选属性",
    "tree": "tree                                 查看文档树",
    "show": "show [ID]                            查看 SVG 或指定元素的 JSON 信息",
    "undo": "undo                                 撤销最近一次编辑",
    "redo": "redo                                 重做最近一次撤销",
    "history": "history                              查看可撤销和可重做的操作",
    "status": "status                               查看文件、修改状态及历史数量",
    "help": "help [命令]                           查看全部或指定命令帮助",
    "quit": "quit [--force]                       退出；未保存时需先保存或显式 --force",
}
SHAPE_HELP = """图形类型与几何属性（未指定的坐标默认为 0）：
  rect      width height（必填），x y rx ry
  circle    r（必填），cx cy
  ellipse   rx ry（必填），cx cy
  line      x1 y1 x2 y2
  polyline  points="0,0 20,20"（至少 2 对坐标）
  polygon   points="0,0 20,20 40,0"（至少 3 对坐标）
  text      x y text="中文及空格"
  g         空分组；可通过 parent=组ID 向组内创建元素
通用属性：fill stroke stroke-width opacity fill-opacity stroke-opacity
  stroke-linecap stroke-linejoin stroke-dasharray fill-rule transform
  font-size font-family font-weight text-anchor
路径、文本和含空格的属性请用引号包围，例如 fill="#336699"。
仅整行 # 注释有效；不会将颜色中的 # 当成注释。"""


def arity(args, minimum, maximum=None):
    maximum = minimum if maximum is None else maximum
    if not minimum <= len(args) <= maximum:
        raise EditorError("参数数量不正确；输入 help 命令名 查看用法")


def attributes(args):
    result = {}
    for token in args:
        if "=" not in token:
            raise EditorError("属性需要使用 属性=值：{}".format(token))
        key, value = token.split("=", 1)
        if not key or key in result:
            raise EditorError("属性名为空或重复：{}".format(key))
        result[key] = value
    return result


def force_flag(args):
    if args.count("--force") > 1:
        raise EditorError("--force 不能重复")
    return [arg for arg in args if arg != "--force"], "--force" in args


class CommandLine:
    def __init__(self, editor=None):
        self.editor = editor or Editor()
        self.running = True
        self.handlers = {
            "new": self._new, "open": self._open, "save": self._save,
            "add": self._add, "move": self._move, "scale": self._scale,
            "group": self._group, "ungroup": self._ungroup, "delete": self._delete,
            "set": self._set, "unset": self._unset, "tree": self._tree,
            "show": self._show, "undo": self._undo, "redo": self._redo,
            "history": self._history, "status": self._status,
            "help": self._help, "quit": self._quit,
        }

    def execute(self, line):
        if not line.strip() or line.lstrip().startswith("#"):
            return ""
        try:
            tokens = shlex.split(line, comments=False)
        except ValueError as exc:
            raise EditorError("命令引号不完整：{}".format(exc)) from exc
        command, args = tokens[0].lower(), tokens[1:]
        if command not in self.handlers:
            raise EditorError("未知命令：{}；输入 help 查看命令".format(command))
        return self.handlers[command](args)

    def _guard_unsaved(self, force):
        if self.editor.dirty and not force:
            raise EditorError("存在未保存修改，请先 save，或在命令中加入 --force 放弃修改")

    def _new(self, args):
        args, force = force_flag(args)
        if len(args) not in (0, 2):
            raise EditorError("用法：new [宽 高] [--force]")
        self._guard_unsaved(force)
        self.editor.new(*args)
        return "已新建画布"

    def _open(self, args):
        args, force = force_flag(args)
        arity(args, 1)
        self._guard_unsaved(force)
        self.editor.open(args[0])
        return "已读取：{}".format(self.editor.path)

    def _save(self, args):
        arity(args, 0, 1)
        return "已保存：{}".format(self.editor.save(args[0] if args else None))

    def _add(self, args):
        arity(args, 1, 100)
        kind = args[0]
        if kind not in SHAPES:
            raise EditorError("不支持的图形：{}；输入 help add 查看类型".format(kind))
        attrs = attributes(args[1:])
        identifier = attrs.pop("id", None)
        if identifier == "":
            raise EditorError("id 不能为空")
        parent = attrs.pop("parent", "root")
        text = attrs.pop("text", "")
        if kind != "text" and text:
            raise EditorError("text= 仅适用于 text 图形")
        identifier = self.editor.add(kind, identifier, attrs, parent, text)
        return "已创建：{} {}".format(kind, identifier)

    def _move(self, args):
        arity(args, 3)
        self.editor.move(*args)
        return "已移动：{}".format(args[0])

    def _scale(self, args):
        if len(args) not in (2, 3, 5):
            raise EditorError("用法：scale ID sx [sy [cx cy]]")
        self.editor.scale(*args)
        return "已缩放：{}".format(args[0])

    def _group(self, args):
        arity(args, 2, 10001)
        self.editor.group(args[0], args[1:])
        return "已分组：{}".format(args[0])

    def _ungroup(self, args):
        arity(args, 1)
        self.editor.ungroup(args[0])
        return "已解除分组：{}".format(args[0])

    def _delete(self, args):
        arity(args, 1)
        self.editor.delete(args[0])
        return "已删除：{}".format(args[0])

    def _set(self, args):
        arity(args, 2, 100)
        self.editor.set_attributes(args[0], attributes(args[1:]))
        return "已修改属性：{}".format(args[0])

    def _unset(self, args):
        arity(args, 2, 100)
        if len(set(args[1:])) != len(args[1:]):
            raise EditorError("属性名不能重复")
        self.editor.unset_attributes(args[0], args[1:])
        return "已移除属性：{}".format(args[0])

    def _tree(self, args):
        arity(args, 0)
        return self.editor.document.tree()

    def _show(self, args):
        arity(args, 0, 1)
        if not args:
            return serialize_svg(self.editor.document).rstrip("\n")
        node = self.editor.document.find(args[0])
        return json.dumps({"id": node.identifier, "type": node.kind, "attributes": node.attrs,
                           "text": node.text, "children": [n.identifier for n in node.children]},
                          ensure_ascii=False, indent=2)

    def _undo(self, args):
        arity(args, 0)
        return "已撤销：{}".format(self.editor.undo())

    def _redo(self, args):
        arity(args, 0)
        return "已重做：{}".format(self.editor.redo())

    def _history(self, args):
        arity(args, 0)
        undo, redo = self.editor.history()
        return "可撤销（从旧到新）：\n{}\n可重做（下次操作在前）：\n{}".format(
            "\n".join("  " + label for label in undo) or "  （无）",
            "\n".join("  " + label for label in redo) or "  （无）")

    def _status(self, args):
        arity(args, 0)
        e = self.editor
        return "文件：{}\n修改状态：{}\n元素：{}\n可撤销：{}，可重做：{}".format(
            e.path or "（未指定）", "未保存" if e.dirty else "无未保存修改",
            sum(1 for _ in e.document.walk()), e.undo_count, e.redo_count)

    def _help(self, args):
        arity(args, 0, 1)
        if args:
            if args[0] not in USAGE:
                raise EditorError("未知命令：{}".format(args[0]))
            return USAGE[args[0]] + ("\n" + SHAPE_HELP if args[0] == "add" else "")
        return "CLI SVG 编辑器 {}\n{}\n\n{}".format(
            __version__, "\n".join(USAGE.values()), SHAPE_HELP)

    def _quit(self, args):
        args, force = force_flag(args)
        arity(args, 0)
        self._guard_unsaved(force)
        self.running = False
        return "已退出"


def main(argv=None, stdin=None, stdout=None, stderr=None):
    stdin = sys.stdin if stdin is None else stdin
    stdout = sys.stdout if stdout is None else stdout
    stderr = sys.stderr if stderr is None else stderr
    parser = argparse.ArgumentParser(description="交互式 CLI SVG 编辑器（Python 标准库）")
    parser.add_argument("--file", metavar="SVG", help="启动时读取 SVG 文件")
    parser.add_argument("--script", metavar="COMMANDS", help="执行 UTF-8 命令文件；遇错停止")
    parser.add_argument("--version", action="version", version=__version__)
    options = parser.parse_args(argv)
    cli = CommandLine()
    script_stream = None
    try:
        if options.file:
            cli.editor.open(options.file)
        if options.script:
            script_stream = Path(options.script).open(encoding="utf-8-sig")
        stream = script_stream if script_stream is not None else stdin
        interactive = script_stream is None and stdin.isatty()
        if interactive:
            print("CLI SVG 编辑器 {}。输入 help 查看命令。".format(__version__), file=stdout)
        line_number = 0
        had_error = False
        while cli.running:
            if interactive:
                print("svg{}> ".format("*" if cli.editor.dirty else ""), end="", file=stdout, flush=True)
            line = stream.readline()
            if not line:
                break
            line_number += 1
            try:
                output = cli.execute(line)
                if output:
                    print(output, file=stdout)
            except EditorError as exc:
                print("错误（第 {} 行）：{}".format(line_number, exc), file=stderr)
                had_error = True
                if script_stream is not None:
                    return 1
        if cli.running and cli.editor.dirty:
            print("输入结束，存在未保存修改；请在命令序列结束前 save。", file=stderr)
            return 1
        return 1 if had_error else 0
    except (EditorError, OSError, UnicodeError) as exc:
        print("错误：{}".format(exc), file=stderr)
        return 1
    except KeyboardInterrupt:
        print("\n已中断，尚未保存的修改不会自动写入文件。", file=stderr)
        return 130
    finally:
        if script_stream is not None:
            script_stream.close()
