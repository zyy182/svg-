import io
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest

from svg_editor.cli import CommandLine, main
from svg_editor.errors import EditorError
from svg_editor.storage import load_svg

ROOT = Path(__file__).resolve().parents[1]


class CLITests(unittest.TestCase):
    def test_quotes_chinese_hex_colors_and_comments(self):
        cli = CommandLine()
        cli.execute('add text id=t text="你好 SVG & <朋友>" fill="#336699" font-family="Arial Unicode MS"')
        node = cli.editor.document.find("t")
        self.assertEqual(node.text, "你好 SVG & <朋友>")
        self.assertEqual(node.attrs["fill"], "#336699")
        self.assertEqual(node.attrs["font-family"], "Arial Unicode MS")
        self.assertEqual(cli.execute("  # 注释"), "")
        self.assertIn("你好 SVG", cli.execute("show t"))
        self.assertIn("&amp;", cli.execute("show"))

    def test_invalid_commands_preserve_document_and_history(self):
        cli = CommandLine()
        cli.execute("add circle id=a r=2")
        before = cli.editor.document.clone()
        for command in ['unknown', 'add circle r="2', 'add circle id=b r=-2',
                        'set a r=3 r=4', 'move a 1', 'scale a 1 2 3',
                        'delete missing', 'tree extra', 'set a id=renamed',
                        'add circle id= r=1', 'add circle parent=a r=1',
                        'group g a a', 'set a text=x', 'new 100', 'help unknown']:
            with self.subTest(command=command), self.assertRaises(EditorError):
                cli.execute(command)
            self.assertEqual(cli.editor.document, before)
            self.assertEqual(cli.editor.undo_count, 1)

    def test_unsaved_guard_and_force(self):
        cli = CommandLine()
        cli.execute("add circle r=2")
        for command in ("new", "quit", "open missing.svg"):
            with self.assertRaises(EditorError):
                cli.execute(command)
        self.assertTrue(cli.running)
        cli.execute("new 200 100 --force")
        self.assertEqual(cli.editor.document.width, 200)
        cli.execute("quit --force")
        self.assertFalse(cli.running)

    def test_stream_eof_errors_and_keyboard_interrupt(self):
        for text, expected in [("help\n", 0), ("add circle r=1\n", 1),
                               ("badcommand\nhelp\n", 1), ("quit --force\n", 0)]:
            output, errors = io.StringIO(), io.StringIO()
            self.assertEqual(main([], io.StringIO(text), output, errors), expected)
            self.assertNotIn("svg> ", output.getvalue())
        class Interrupted(io.StringIO):
            def readline(self, *args):
                raise KeyboardInterrupt
        self.assertEqual(main([], Interrupted(), io.StringIO(), io.StringIO()), 130)

    def test_script_stops_before_later_save_on_failure(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "failed.commands"
            target = Path(folder) / "must-not-exist.svg"
            path.write_text('add circle r=1\nmove missing 1 2\nsave "{}"\n'.format(target), encoding="utf-8")
            output, errors = io.StringIO(), io.StringIO()
            self.assertEqual(main(["--script", str(path)], stdout=output, stderr=errors), 1)
            self.assertIn("第 2 行", errors.getvalue())
            self.assertFalse(target.exists())

    def test_real_process_complete_workflow_and_reload(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "中文 文件.svg"
            commands = ('new 400 300\nadd rect id=r width=20 height=10 fill="#336699"\n'
                        'add circle id=c r=5\ngroup g r c\nmove g 10 20\nscale g 2\n'
                        'set c fill=red\nundo\nredo\nungroup g\ndelete c\nundo\nredo\n'
                        'save "{}"\nopen "{}"\ntree\nstatus\nquit\n').format(path, path)
            result = subprocess.run([sys.executable, "-m", "svg_editor"], input=commands,
                                    capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertIn("无未保存修改", result.stdout)
            document = load_svg(path)
            self.assertEqual([n.identifier for n in document.children], ["r"])
            self.assertEqual(document.find("r").attrs["transform"], "matrix(2 0 0 2 20 40)")
            reopened = subprocess.run([sys.executable, "main.py", "--file", str(path)],
                                      input="tree\nquit\n", capture_output=True, text=True, cwd=ROOT)
            self.assertEqual(reopened.returncode, 0, reopened.stderr)
            self.assertIn("rect r", reopened.stdout)

    def test_all_help_and_query_commands(self):
        cli = CommandLine()
        for command in ("help", "help add", "tree", "show", "status", "history"):
            self.assertTrue(cli.execute(command))
        cli.execute("add g id=empty")
        cli.execute('add text id=t parent=empty text="文字"')
        cli.execute('set t font-size=20 text="新的文字"')
        cli.execute("unset t font-size")
        self.assertEqual(cli.editor.document.find("t").text, "新的文字")
        self.assertNotIn("font-size", cli.editor.document.find("t").attrs)


if __name__ == "__main__":
    unittest.main()
