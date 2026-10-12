"""Application service: successful edits are atomic and can be undone."""

from pathlib import Path

from .errors import EditorError
from .model import Document
from .storage import load_svg, save_svg, serialize_svg
from .transforms import number, scaling, translation


class Editor:
    def __init__(self, history_limit=100):
        if history_limit < 1:
            raise ValueError("history_limit must be positive")
        self.document = Document()
        self.path = None
        self.history_limit = history_limit
        self._undo = []
        self._redo = []
        self._saved_xml = serialize_svg(self.document)

    @property
    def dirty(self):
        return self._saved_xml != serialize_svg(self.document)

    @property
    def undo_count(self):
        return len(self._undo)

    @property
    def redo_count(self):
        return len(self._redo)

    def _replace(self, document, path=None, saved=False):
        document.validate()
        self.document = document
        self.path = path
        self._undo.clear()
        self._redo.clear()
        self._saved_xml = serialize_svg(document) if saved else None

    def new(self, width=800, height=600):
        document = Document(number(width), number(height))
        self._replace(document)

    def open(self, path):
        # Loading completes before touching any current state.
        document = load_svg(path)
        self._replace(document, Path(path).resolve(), saved=True)

    def save(self, path=None):
        try:
            destination = Path(path).resolve() if path is not None else self.path
        except (OSError, ValueError) as exc:
            raise EditorError("无效的保存路径：{}".format(exc)) from exc
        if destination is None:
            raise EditorError("首次保存需要指定路径：save 文件.svg")
        save_svg(self.document, destination)
        self.path = destination
        self._saved_xml = serialize_svg(self.document)
        return str(destination)

    def apply(self, label, operation):
        candidate = self.document.clone()
        result = operation(candidate)
        candidate.validate()
        if candidate == self.document:
            return result
        self._undo.append((label, self.document.clone()))
        if len(self._undo) > self.history_limit:
            self._undo.pop(0)
        self.document = candidate
        self._redo.clear()
        return result

    def add(self, kind, identifier=None, attrs=None, parent="root", text=""):
        return self.apply("add {}".format(kind), lambda d: d.add(
            kind, identifier, attrs, parent, text))

    def delete(self, identifier):
        self.apply("delete {}".format(identifier), lambda d: d.delete(identifier))

    def set_attributes(self, identifier, attrs):
        self.apply("set {}".format(identifier), lambda d: d.set_attributes(identifier, attrs))

    def unset_attributes(self, identifier, keys):
        self.apply("unset {}".format(identifier), lambda d: d.unset_attributes(identifier, keys))

    def move(self, identifier, dx, dy):
        matrix = translation(dx, dy)
        self.apply("move {}".format(identifier), lambda d: d.transform(identifier, matrix))

    def scale(self, identifier, sx, sy=None, cx=0, cy=0):
        matrix = scaling(sx, sx if sy is None else sy, cx, cy)
        self.apply("scale {}".format(identifier), lambda d: d.transform(identifier, matrix))

    def group(self, identifier, members):
        self.apply("group {}".format(identifier), lambda d: d.group(identifier, members))

    def ungroup(self, identifier):
        self.apply("ungroup {}".format(identifier), lambda d: d.ungroup(identifier))

    def undo(self):
        if not self._undo:
            raise EditorError("没有可撤销的操作")
        label, document = self._undo.pop()
        self._redo.append((label, self.document.clone()))
        self.document = document
        return label

    def redo(self):
        if not self._redo:
            raise EditorError("没有可重做的操作")
        label, document = self._redo.pop()
        self._undo.append((label, self.document.clone()))
        self.document = document
        return label

    def history(self):
        return ([label for label, _ in self._undo],
                [label for label, _ in reversed(self._redo)])
