import unittest

from svg_editor.errors import EditorError
from svg_editor.model import Document, Node
from svg_editor.transforms import multiply, parse_transform, scaling, translation


class ModelTests(unittest.TestCase):
    def setUp(self):
        self.doc = Document()
        self.doc.add("rect", "a", {"width": "20", "height": "10"})
        self.doc.add("circle", "b", {"r": "5"})

    def test_all_shapes_and_validation(self):
        for kind, attrs in [("ellipse", {"rx": "4", "ry": "3"}),
                            ("line", {"x1": "0", "x2": "10"}),
                            ("polyline", {"points": "0,0 10,10"}),
                            ("polygon", {"points": "0,0 10,10 20,0"}),
                            ("text", {"x": "5"})]:
            self.doc.add(kind, attrs=attrs)
        self.doc.validate()
        for attrs in ({"r": "-1"}, {"r": "nan"}, {"r": "1", "opacity": "2"},
                      {"r": "1", "script": "x"}):
            with self.assertRaises(EditorError):
                self.doc.add("circle", attrs=attrs)
        with self.assertRaises(EditorError):
            self.doc.add("circle", "a", {"r": "1"})

    def test_nested_group_delete_and_clone(self):
        self.doc.group("group1", ["b", "a"])
        self.assertEqual([n.identifier for n in self.doc.find("group1").children], ["a", "b"])
        self.doc.add("text", "title", parent="group1", text="你好")
        self.doc.group("outer", ["group1"])
        clone = self.doc.clone()
        self.doc.delete("outer")
        self.assertEqual(self.doc.children, [])
        self.assertEqual(clone.find("title").text, "你好")

    def test_group_rejects_invalid_structure_without_mutation(self):
        self.doc.add("circle", "c", {"r": "1"})
        before = self.doc.clone()
        for members in (["a", "c"], ["a", "a"], ["a", "missing"]):
            with self.assertRaises(EditorError):
                self.doc.group("g1", members)
            self.assertEqual(self.doc, before)
        self.doc.group("g1", ["a"])
        with self.assertRaises(EditorError):
            self.doc.group("g2", ["a", "b"])

    def test_set_is_atomic(self):
        before = self.doc.clone()
        with self.assertRaises(EditorError):
            self.doc.set_attributes("a", {"fill": "red", "width": "-2"})
        self.assertEqual(self.doc, before)
        with self.assertRaises(EditorError):
            self.doc.unset_attributes("a", ["width"])
        self.assertEqual(self.doc, before)

    def test_ungroup_preserves_transform_and_inheritance(self):
        self.doc.group("g1", ["a", "b"])
        self.doc.set_attributes("g1", {"fill": "blue", "transform": "translate(10 20)"})
        self.doc.set_attributes("b", {"fill": "red", "transform": "scale(2)"})
        self.doc.ungroup("g1")
        self.assertEqual(self.doc.find("a").attrs["fill"], "blue")
        self.assertEqual(self.doc.find("b").attrs["fill"], "red")
        self.assertEqual(parse_transform(self.doc.find("b").attrs["transform"]),
                         (2, 0, 0, 2, 10, 20))

    def test_ungroup_opacity_is_rejected(self):
        self.doc.group("g1", ["a", "b"])
        self.doc.set_attributes("g1", {"opacity": "0.5"})
        before = self.doc.clone()
        with self.assertRaises(EditorError):
            self.doc.ungroup("g1")
        self.assertEqual(self.doc, before)

    def test_transform_order_and_center(self):
        self.assertEqual(parse_transform("translate(10 20) scale(2 3)"), (2, 0, 0, 3, 10, 20))
        self.assertEqual(scaling(2, 3, 10, 20), (2, 0, 0, 3, -10, -40))
        self.assertEqual(multiply(translation(1, 2), scaling(2, 2)), (2, 0, 0, 2, 1, 2))
        self.doc.transform("a", translation(10, 20))
        self.doc.transform("a", scaling(2, 2))
        self.assertEqual(parse_transform(self.doc.find("a").attrs["transform"]), (2, 0, 0, 2, 20, 40))
        for invalid in ("translate(x)", "rotate(1 2)", "scale()", "matrix(1 2)"):
            with self.assertRaises(EditorError):
                parse_transform(invalid)

    def test_cycles_and_shared_nodes_rejected(self):
        group = Node("g", "cycle")
        group.children.append(group)
        with self.assertRaises(EditorError):
            Document(children=[group]).validate()
        shape = self.doc.find("a")
        with self.assertRaises(EditorError):
            Document(children=[shape, shape]).validate()


if __name__ == "__main__":
    unittest.main()
