import io
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from svg_editor.cli import CommandLine, main
from svg_editor.editor import Editor
from svg_editor.errors import EditorError
from svg_editor.model import Document, Node
from svg_editor.storage import load_svg, parse_svg, save_svg
from svg_editor.transforms import number, parse_transform


class RegressionTests(unittest.TestCase):
    def test_python_numeric_syntax_is_not_accepted_as_svg(self):
        for value in ("1_000", "NaN", "Infinity", "1e999", "0x10", ""):
            with self.subTest(value=value), self.assertRaises(EditorError):
                number(value)
        self.assertEqual(number(" -.5e+2 "), -50)

    def test_transform_separators_and_rotation(self):
        for value in ("translate(1),", "translate(1),,scale(2)",
                      "translate(1)scale(2)", "translate(1) garbage"):
            with self.subTest(value=value), self.assertRaises(EditorError):
                parse_transform(value)
        self.assertEqual(parse_transform("translate(1), scale(2)"), (2, 0, 0, 2, 1, 0))
        matrix = parse_transform("rotate(90 10 20)")
        x, y = 10, 20
        self.assertAlmostEqual(matrix[0]*x + matrix[2]*y + matrix[4], x)
        self.assertAlmostEqual(matrix[1]*x + matrix[3]*y + matrix[5], y)
        self.assertEqual(parse_transform("matrix(1 0 0 1 2 3)"), (1, 0, 0, 1, 2, 3))
        self.assertAlmostEqual(parse_transform("skewX(45)")[2], 1)
        self.assertAlmostEqual(parse_transform("skewY(45)")[1], 1)

    def test_null_path_fails_as_user_error(self):
        with self.assertRaises(EditorError):
            load_svg("invalid\0.svg")
        with self.assertRaises(EditorError):
            Editor().save("invalid\0.svg")

    def test_import_failure_preserves_document_and_redo(self):
        e = Editor()
        e.add("text", "a", text="original")
        e.set_attributes("a", {"text": "changed"})
        e.undo()
        before = e.document.clone()
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "invalid.svg"
            path.write_text('<svg><circle r="-1"/></svg>', encoding="utf-8")
            with self.assertRaises(EditorError):
                e.open(path)
        self.assertEqual(e.document, before)
        self.assertEqual((e.undo_count, e.redo_count), (1, 1))

    def test_save_failure_keeps_dirty_path_and_history(self):
        e = Editor()
        e.add("circle", "a", {"r": "1"})
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "a.svg"
            e.save(path)
            e.move("a", 1, 2)
            other = Path(folder) / "b.svg"
            with patch("svg_editor.storage.os.replace", side_effect=OSError("failure")):
                with self.assertRaises(EditorError):
                    e.save(other)
            self.assertEqual(e.path, path.resolve())
            self.assertTrue(e.dirty)
            self.assertEqual(e.undo_count, 2)
            self.assertFalse(other.exists())
            self.assertNotIn("transform", load_svg(path).find("a").attrs)

    def test_document_resource_limits_apply_to_editing(self):
        root = Node("g", "g0")
        current = root
        for index in range(1, 129):
            child = Node("g", "g{}".format(index))
            current.children.append(child)
            current = child
        with self.assertRaises(EditorError):
            Document(children=[root]).validate()
        document = Document(children=[Node("circle", "a{}".format(i), {"r": "1"})
                                      for i in range(10001)])
        with self.assertRaises(EditorError):
            document.validate()

    def test_export_limit_does_not_create_file(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "large.svg"
            with patch("svg_editor.storage.MAX_FILE_BYTES", 10), self.assertRaises(EditorError):
                save_svg(Document(), path)
            self.assertFalse(path.exists())

    def test_overflow_and_invalid_style_do_not_change_state(self):
        cli = CommandLine()
        cli.execute("add circle id=a r=1")
        cli.execute("move a 1e308 1e308")
        before = cli.editor.document.clone()
        for command in ("scale a 1e308", "set a font-weight=banana", "set a font-family=''"):
            with self.subTest(command=command), self.assertRaises(EditorError):
                cli.execute(command)
            self.assertEqual(cli.editor.document, before)

    def test_script_file_and_startup_file_errors(self):
        for arguments in (["--script", "/missing-svg-commands.txt"],
                          ["--file", "/missing-svg-document.svg"]):
            errors = io.StringIO()
            self.assertEqual(main(arguments, io.StringIO(), io.StringIO(), errors), 1)
            self.assertIn("错误", errors.getvalue())

    def test_utf8_bom_comments_and_default_positions(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bom.svg"
            path.write_bytes(b'\xef\xbb\xbf<svg><!-- comment --><circle r="1"/></svg>')
            document = load_svg(path)
            self.assertEqual(document.find("n1").attrs, {"r": "1"})
        self.assertEqual(parse_svg('<svg><line/></svg>').children[0].kind, "line")


if __name__ == "__main__":
    unittest.main()
