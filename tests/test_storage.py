from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from svg_editor.errors import EditorError
from svg_editor.model import Document
from svg_editor.storage import load_svg, parse_svg, save_svg, serialize_svg


class StorageTests(unittest.TestCase):
    def test_roundtrip_all_shapes_attributes_and_text(self):
        document = Document(640, 480, viewbox="0 0 320 240", attrs={"fill": "blue"})
        for kind, attrs in [("rect", {"width": "100", "height": "20"}),
                            ("circle", {"r": "5"}), ("ellipse", {"rx": "5", "ry": "2"}),
                            ("line", {"x1": "1", "x2": "5"}),
                            ("polygon", {"points": "0,0 10,10 20,0"}),
                            ("polyline", {"points": "0,0 10,10"}),
                            ("text", {"x": "2", "font-family": "Arial"})]:
            document.add(kind, attrs=attrs, text="中文 & <SVG>" if kind == "text" else "")
        document.group("nested", [node.identifier for node in document.children])
        document.set_attributes("nested", {"transform": "translate(10 20) scale(2)"})
        self.assertEqual(parse_svg(serialize_svg(document)), document)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "含 空格.svg"
            save_svg(document, path)
            self.assertEqual(load_svg(path), document)

    def test_text_whitespace_is_preserved(self):
        document = Document()
        document.add("text", "a", text="  \t ")
        self.assertEqual(parse_svg(serialize_svg(document)).find("a").text, "  \t ")

    def test_anonymous_ids_avoid_explicit_ids(self):
        document = parse_svg('<svg><circle r="1"/><circle id="n1" r="2"/></svg>')
        self.assertEqual([n.identifier for n in document.children], ["n2", "n1"])
        self.assertEqual(document.add("circle", attrs={"r": "3"}), "n3")

    def test_rejects_unsupported_or_malformed_content(self):
        invalid = ['<html/>', '<svg>', '<svg><path d="M0 0"/></svg>',
                   '<svg><script>oops</script></svg>',
                   '<!DOCTYPE svg [<!ENTITY x "a">]><svg/>',
                   '<svg><circle id="a" r="1"/><circle id="a" r="2"/></svg>',
                   '<svg style="fill:red"/>', '<svg><text><tspan>x</tspan></text></svg>',
                   '<svg><circle id="root" r="1"/></svg>',
                   '<svg><circle r="1"/>stray</svg>',
                   '<svg xmlns="urn:other"/>', '<svg width="50%"/>']
        for source in invalid:
            with self.subTest(source=source), self.assertRaises(EditorError):
                parse_svg(source)

    def test_px_lengths_and_root_properties(self):
        document = parse_svg('<svg width="100px" height="20px" fill="red">'
                             '<rect width="5px" height="6px"/></svg>')
        self.assertEqual((document.width, document.height), (100, 20))
        self.assertEqual(document.children[0].attrs, {"width": "5", "height": "6"})
        self.assertEqual(document.attrs, {"fill": "red"})

    def test_failed_save_preserves_original_and_cleans_temporary(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "original.svg"
            path.write_text("original", encoding="utf-8")
            with patch("svg_editor.storage.os.replace", side_effect=OSError("simulated")):
                with self.assertRaises(EditorError):
                    save_svg(Document(), path)
            self.assertEqual(path.read_text(encoding="utf-8"), "original")
            self.assertEqual(list(Path(folder).iterdir()), [path])

    def test_file_errors_and_limits(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(EditorError):
                load_svg(Path(folder) / "missing.svg")
            with self.assertRaises(EditorError):
                save_svg(Document(), Path(folder) / "missing" / "a.svg")
            path = Path(folder) / "bad.svg"
            path.write_bytes(b"\xff")
            with self.assertRaises(EditorError):
                load_svg(path)
            path.write_text("<svg/>" * 10, encoding="utf-8")
            with patch("svg_editor.storage.MAX_FILE_BYTES", 10), self.assertRaises(EditorError):
                load_svg(path)
        with self.assertRaises(EditorError):
            parse_svg("<svg>" + "<g>" * 129 + "</g>" * 129 + "</svg>")


if __name__ == "__main__":
    unittest.main()
