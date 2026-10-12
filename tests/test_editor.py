from pathlib import Path
import tempfile
import unittest

from svg_editor.editor import Editor
from svg_editor.errors import EditorError


class EditorTests(unittest.TestCase):
    def setUp(self):
        self.editor = Editor()

    def test_complete_edit_undo_redo_sequence(self):
        e = self.editor
        initial = e.document.clone()
        states = [initial]
        operations = [lambda: e.add("rect", "r", {"width": "20", "height": "10"}),
                      lambda: e.add("circle", "c", {"r": "5"}),
                      lambda: e.group("g1", ["r", "c"]),
                      lambda: e.move("g1", 10, 20),
                      lambda: e.scale("g1", 2, 3, 10, 20),
                      lambda: e.set_attributes("r", {"fill": "red", "stroke": "black"}),
                      lambda: e.ungroup("g1"), lambda: e.delete("c")]
        for operation in operations:
            operation()
            states.append(e.document.clone())
        for expected in reversed(states[:-1]):
            e.undo()
            self.assertEqual(e.document, expected)
        for expected in states[1:]:
            e.redo()
            self.assertEqual(e.document, expected)

    def test_failed_and_noop_edits_do_not_destroy_redo(self):
        e = self.editor
        e.add("circle", "a", {"r": "2"})
        e.set_attributes("a", {"fill": "red"})
        e.undo()
        before = e.document.clone()
        with self.assertRaises(EditorError):
            e.set_attributes("a", {"fill": "blue", "r": "-1"})
        self.assertEqual(e.document, before)
        self.assertEqual((e.undo_count, e.redo_count), (1, 1))
        e.set_attributes("a", {"r": "2"})
        self.assertEqual((e.undo_count, e.redo_count), (1, 1))
        e.redo()
        self.assertEqual(e.document.find("a").attrs["fill"], "red")

    def test_new_edit_clears_redo_and_history_is_bounded(self):
        e = Editor(history_limit=2)
        e.add("circle", "a", {"r": "2"})
        e.move("a", 1, 2)
        e.move("a", 3, 4)
        self.assertEqual(e.undo_count, 2)
        e.undo()
        e.scale("a", 2)
        self.assertEqual(e.redo_count, 0)
        with self.assertRaises(EditorError):
            e.redo()

    def test_dirty_tracks_saved_document_across_history(self):
        e = self.editor
        e.add("circle", "a", {"r": "2"})
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "a.svg"
            e.save(path)
            self.assertFalse(e.dirty)
            e.move("a", 3, 4)
            self.assertTrue(e.dirty)
            e.undo()
            self.assertFalse(e.dirty)
            e.redo()
            self.assertTrue(e.dirty)
            e.save()
            self.assertFalse(e.dirty)
            self.assertEqual((e.undo_count, e.redo_count), (2, 0))

    def test_open_and_new_clear_history_only_after_success(self):
        e = self.editor
        e.add("circle", "a", {"r": "2"})
        before = e.document.clone()
        with self.assertRaises(EditorError):
            e.open("/nonexistent-svg-editor-test.svg")
        with self.assertRaises(EditorError):
            e.new(-1, 100)
        self.assertEqual(e.document, before)
        self.assertEqual(e.undo_count, 1)
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "a.svg"
            e.save(path)
            e.open(path)
            self.assertFalse(e.dirty)
            self.assertEqual(e.undo_count, 0)
        e.new(200, 100)
        self.assertEqual(e.document.children, [])
        self.assertIsNone(e.path)
        self.assertTrue(e.dirty)

    def test_failure_inside_transaction_does_not_leak_partial_changes(self):
        e = self.editor
        before = e.document.clone()
        def failing(document):
            document.add("circle", "a", {"r": "2"})
            document.add("circle", "b", {"r": "-1"})
        with self.assertRaises(EditorError):
            e.apply("broken", failing)
        self.assertEqual(e.document, before)
        self.assertEqual(e.undo_count, 0)


if __name__ == "__main__":
    unittest.main()
