"""Document tree and its invariants, independent of files and the terminal."""

from copy import deepcopy
from dataclasses import dataclass, field
import re
from typing import Dict, List, Optional

from .errors import EditorError
from .transforms import fmt, matrix_text, multiply, number, numbers, parse_transform

SHAPES = {
    "rect": {"x", "y", "width", "height", "rx", "ry"},
    "circle": {"cx", "cy", "r"},
    "ellipse": {"cx", "cy", "rx", "ry"},
    "line": {"x1", "y1", "x2", "y2"},
    "polyline": {"points"},
    "polygon": {"points"},
    "text": {"x", "y"},
    "g": set(),
}
REQUIRED = {
    "rect": {"width", "height"}, "circle": {"r"},
    "ellipse": {"rx", "ry"}, "polyline": {"points"},
    "polygon": {"points"},
}
PRESENTATION = {
    "fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity",
    "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "font-size",
    "font-family", "font-weight", "text-anchor", "fill-rule",
}
NONNEGATIVE = {"width", "height", "r", "rx", "ry", "stroke-width", "font-size"}
IDENTIFIER = re.compile(r"[A-Za-z_][A-Za-z0-9_.:-]*\Z")


def validate_id(identifier):
    if not IDENTIFIER.fullmatch(identifier) or identifier == "root":
        raise EditorError("ID 必须以字母或下划线开头；root 为保留 ID")


def validate_attributes(kind, attrs):
    if kind not in SHAPES:
        raise EditorError("不支持的图形：{}".format(kind))
    allowed = SHAPES[kind] | PRESENTATION | {"transform"}
    unknown = set(attrs) - allowed
    if unknown:
        raise EditorError("{} 不支持属性：{}".format(kind, ", ".join(sorted(unknown))))
    missing = REQUIRED.get(kind, set()) - set(attrs)
    if missing:
        raise EditorError("缺少属性：{}".format(", ".join(sorted(missing))))
    for key, value in attrs.items():
        if not isinstance(value, str):
            raise EditorError("属性值必须是字符串")
        if any(ord(char) < 32 and char not in "\t\r\n" for char in value):
            raise EditorError("属性中含有 XML 不支持的控制字符")
        if key in SHAPES[kind] - {"points"} or key in NONNEGATIVE:
            numeric = number(value)
            if key in NONNEGATIVE and numeric < 0:
                raise EditorError("{} 不能为负数".format(key))
        elif key in {"opacity", "fill-opacity", "stroke-opacity"}:
            if not 0 <= number(value) <= 1:
                raise EditorError("{} 必须在 0 到 1 之间".format(key))
        elif key == "points":
            coordinates = numbers(value)
            minimum = 6 if kind == "polygon" else 4
            if len(coordinates) < minimum or len(coordinates) % 2:
                raise EditorError("points 需要至少 {} 对坐标".format(minimum // 2))
        elif key == "transform":
            parse_transform(value)
        elif key in {"fill", "stroke"}:
            if not re.fullmatch(r"(?:none|currentColor|[A-Za-z]+|#[0-9a-fA-F]{3}|#[0-9a-fA-F]{4}|#[0-9a-fA-F]{6}|#[0-9a-fA-F]{8}|rgba?\([\d\s.,%+\-]+\))", value):
                raise EditorError("颜色支持名称、十六进制、rgb/rgba、none 或 currentColor")
        elif key == "stroke-dasharray" and value != "none":
            values = numbers(value)
            if not values or any(x < 0 for x in values):
                raise EditorError("stroke-dasharray 需要非负数值列表或 none")
        elif key == "font-weight":
            if value not in {"normal", "bold", "bolder", "lighter"}:
                if not re.fullmatch(r"[1-9]00", value):
                    raise EditorError("font-weight 支持 normal/bold/bolder/lighter 或 100…900")
        elif key == "font-family" and not value.strip():
            raise EditorError("font-family 不能为空")
        elif key in {"stroke-linecap", "stroke-linejoin", "text-anchor", "fill-rule"}:
            choices = {"stroke-linecap": {"butt", "round", "square"},
                       "stroke-linejoin": {"miter", "round", "bevel"},
                       "text-anchor": {"start", "middle", "end"},
                       "fill-rule": {"nonzero", "evenodd"}}
            if value not in choices[key]:
                raise EditorError("{} 的值无效".format(key))


@dataclass
class Node:
    kind: str
    identifier: str
    attrs: Dict[str, str] = field(default_factory=dict)
    children: List["Node"] = field(default_factory=list)
    text: str = ""

    def validate(self):
        validate_id(self.identifier)
        validate_attributes(self.kind, self.attrs)
        if self.kind != "g" and self.children:
            raise EditorError("只有分组可以包含子节点")
        if self.kind != "text" and self.text:
            raise EditorError("只有 text 图形可以包含文本")
        if any(ord(char) < 32 and char not in "\t\r\n" for char in self.text):
            raise EditorError("文本中含有 XML 不支持的控制字符")


@dataclass
class Document:
    width: float = 800
    height: float = 600
    children: List[Node] = field(default_factory=list)
    viewbox: Optional[str] = None
    attrs: Dict[str, str] = field(default_factory=dict)

    def clone(self):
        return deepcopy(self)

    def walk(self):
        def visit(children, depth):
            for node in children:
                yield node, depth
                yield from visit(node.children, depth + 1)
        return visit(self.children, 1)

    def validate(self):
        if number(self.width) <= 0 or number(self.height) <= 0:
            raise EditorError("画布宽高必须大于 0")
        if self.viewbox is not None:
            values = numbers(self.viewbox)
            if len(values) != 4 or values[2] <= 0 or values[3] <= 0:
                raise EditorError("viewBox 需要 x y width height，宽高必须大于 0")
        validate_attributes("g", self.attrs)
        if "transform" in self.attrs:
            raise EditorError("根 SVG 不支持 transform")
        seen, objects = set(), set()

        def visit(children, depth=1):
            for node in children:
                if depth > 128 or len(objects) >= 10000:
                    raise EditorError("文档最多包含 10000 个元素、128 层嵌套")
                if id(node) in objects:
                    raise EditorError("树中存在重复引用或循环")
                objects.add(id(node))
                node.validate()
                if node.identifier in seen:
                    raise EditorError("重复 ID：{}".format(node.identifier))
                seen.add(node.identifier)
                visit(node.children, depth + 1)
        visit(self.children)

    def find(self, identifier):
        for node, _ in self.walk():
            if node.identifier == identifier:
                return node
        raise EditorError("找不到元素：{}".format(identifier))

    def siblings(self, identifier):
        def visit(children):
            for node in children:
                if node.identifier == identifier:
                    return children
                found = visit(node.children)
                if found is not None:
                    return found
            return None
        result = visit(self.children)
        if result is None:
            raise EditorError("找不到元素：{}".format(identifier))
        return result

    def computed_font_weight(self, identifier):
        """Resolve relative font weights along the ancestry of one node."""
        def resolve(value, inherited):
            if value == "normal":
                return 400
            if value == "bold":
                return 700
            if value == "bolder":
                return 400 if inherited < 400 else (700 if inherited < 600 else 900)
            if value == "lighter":
                return 100 if inherited < 600 else (400 if inherited < 800 else 700)
            return int(value)

        def visit(children, inherited):
            for child in children:
                weight = resolve(child.attrs["font-weight"], inherited) if "font-weight" in child.attrs else inherited
                if child.identifier == identifier:
                    return weight
                found = visit(child.children, weight)
                if found is not None:
                    return found
            return None

        root_weight = resolve(self.attrs.get("font-weight", "normal"), 400)
        result = visit(self.children, root_weight)
        if result is None:
            raise EditorError("找不到元素：{}".format(identifier))
        return result

    def container(self, parent):
        if parent == "root":
            return self.children
        node = self.find(parent)
        if node.kind != "g":
            raise EditorError("父元素必须是分组")
        return node.children

    def available_id(self, identifier):
        validate_id(identifier)
        if any(node.identifier == identifier for node, _ in self.walk()):
            raise EditorError("重复 ID：{}".format(identifier))

    def next_id(self):
        used = {node.identifier for node, _ in self.walk()}
        index = 1
        while "n{}".format(index) in used:
            index += 1
        return "n{}".format(index)

    def add(self, kind, identifier=None, attrs=None, parent="root", text=""):
        identifier = identifier or self.next_id()
        self.available_id(identifier)
        node = Node(kind, identifier, dict(attrs or {}), text=text)
        node.validate()
        self.container(parent).append(node)
        return identifier

    def delete(self, identifier):
        siblings = self.siblings(identifier)
        siblings.remove(self.find(identifier))

    def set_attributes(self, identifier, attrs):
        node = self.find(identifier)
        if "id" in attrs:
            raise EditorError("ID 不可通过 set 修改")
        updated = dict(node.attrs)
        text = attrs.get("text", node.text)
        updated.update({k: v for k, v in attrs.items() if k != "text"})
        proposed = Node(node.kind, node.identifier, updated, node.children, text)
        proposed.validate()
        node.attrs, node.text = updated, text

    def unset_attributes(self, identifier, keys):
        node = self.find(identifier)
        if not keys or any(key not in node.attrs for key in keys):
            raise EditorError("需要指定已存在的属性")
        updated = {k: v for k, v in node.attrs.items() if k not in keys}
        validate_attributes(node.kind, updated)
        node.attrs = updated

    def transform(self, identifier, matrix):
        node = self.find(identifier)
        old = parse_transform(node.attrs.get("transform", ""))
        node.attrs["transform"] = matrix_text(multiply(matrix, old))

    def group(self, identifier, members):
        self.available_id(identifier)
        if not members or len(set(members)) != len(members):
            raise EditorError("分组需要至少一个成员，且成员不能重复")
        siblings = self.siblings(members[0])
        if any(self.siblings(member) is not siblings for member in members):
            raise EditorError("只能对同一父节点的元素分组")
        indexes = sorted(next(i for i, n in enumerate(siblings)
                              if n.identifier == member) for member in members)
        if indexes != list(range(indexes[0], indexes[-1] + 1)):
            raise EditorError("为保留绘制顺序，只能对连续同级元素分组")
        children = siblings[indexes[0]:indexes[-1]+1]
        siblings[indexes[0]:indexes[-1]+1] = [Node("g", identifier, children=children)]

    def ungroup(self, identifier):
        node = self.find(identifier)
        if node.kind != "g":
            raise EditorError("ungroup 的目标必须是分组")
        if number(node.attrs.get("opacity", "1")) != 1:
            raise EditorError("透明度不为 1 的分组无法在保持外观的情况下解除；请先恢复 opacity=1")
        inherited = {k: v for k, v in node.attrs.items()
                     if k not in {"opacity", "transform"}}
        group_matrix = parse_transform(node.attrs.get("transform", ""))
        children = deepcopy(node.children)
        for child in children:
            # Removing an ancestor changes the meaning of bolder/lighter.
            # Freeze the child's computed value before flattening the group.
            if child.attrs.get("font-weight") in {"bolder", "lighter"}:
                child.attrs["font-weight"] = str(self.computed_font_weight(child.identifier))
            child.attrs = dict(inherited, **child.attrs)
            if "transform" in node.attrs:
                child.attrs["transform"] = matrix_text(multiply(
                    group_matrix, parse_transform(child.attrs.get("transform", ""))))
            child.validate()
        siblings = self.siblings(identifier)
        index = siblings.index(node)
        siblings[index:index+1] = children

    def tree(self):
        lines = ["svg root width={} height={}".format(fmt(self.width), fmt(self.height))]
        for node, depth in self.walk():
            properties = " ".join("{}={!r}".format(k, v) for k, v in sorted(node.attrs.items()))
            if node.kind == "text":
                properties += " text={!r}".format(node.text)
            lines.append("  " * depth + "{} {}{}".format(
                node.kind, node.identifier, " " + properties if properties else ""))
        return "\n".join(lines)
