"""An explicit SVG subset, UTF-8 XML, and atomic file replacement."""

import os
from pathlib import Path
import re
import tempfile
import xml.etree.ElementTree as ET

from .errors import EditorError
from .model import Document, Node, SHAPES, PRESENTATION
from .transforms import fmt, number

SVG_NAMESPACE = "http://www.w3.org/2000/svg"
MAX_FILE_BYTES = 5 * 1024 * 1024
MAX_DEPTH = 128
MAX_NODES = 10000
ET.register_namespace("", SVG_NAMESPACE)


def tag_name(tag):
    if tag.startswith("{"):
        namespace, local = tag[1:].split("}", 1)
        if namespace != SVG_NAMESPACE:
            raise EditorError("不支持的 XML 命名空间：{}".format(namespace))
        return local
    return tag


def parse_svg(source):
    if re.search(r"<!\s*(?:DOCTYPE|ENTITY)\b", source, re.IGNORECASE):
        raise EditorError("不支持带 DOCTYPE 或 ENTITY 的 SVG")
    try:
        root = ET.fromstring(source)
    except (ET.ParseError, ValueError) as exc:
        raise EditorError("无效的 SVG XML：{}".format(exc)) from exc
    if tag_name(root.tag) != "svg":
        raise EditorError("文件根元素必须是 svg")
    root_attrs = dict(root.attrib)
    unknown = set(root_attrs) - {"width", "height", "viewBox", "version"} - PRESENTATION
    if unknown:
        raise EditorError("根 SVG 不支持属性：{}".format(", ".join(sorted(unknown))))
    if root_attrs.get("version", "1.1") not in {"1.0", "1.1", "2.0"}:
        raise EditorError("不支持的 SVG version")

    def length(value):
        return number(value[:-2] if value.endswith("px") else value)

    document = Document(length(root_attrs.get("width", "800")),
                        length(root_attrs.get("height", "600")),
                        viewbox=root_attrs.get("viewBox"),
                        attrs={k: v for k, v in root_attrs.items() if k in PRESENTATION})
    # Reserve explicit IDs before assigning IDs to anonymous elements.
    reserved = set()
    for element in root.iter():
        identifier = element.get("id")
        if identifier is not None:
            if identifier in reserved:
                raise EditorError("重复 ID：{}".format(identifier))
            reserved.add(identifier)
    count = 0
    next_index = 1

    def convert(element, depth):
        nonlocal count, next_index
        count += 1
        if depth > MAX_DEPTH or count > MAX_NODES:
            raise EditorError("SVG 超出限制：最多 10000 个元素、128 层嵌套")
        kind = tag_name(element.tag)
        if kind not in SHAPES:
            raise EditorError("不支持的 SVG 元素：{}".format(kind))
        attrs = dict(element.attrib)
        identifier = attrs.pop("id", None)
        if identifier is None:
            while "n{}".format(next_index) in reserved:
                next_index += 1
            identifier = "n{}".format(next_index)
            reserved.add(identifier)
            next_index += 1
        for key in SHAPES[kind] - {"points"}:
            if key in attrs and attrs[key].endswith("px"):
                attrs[key] = fmt(length(attrs[key]))
        if kind != "text" and element.text and element.text.strip():
            raise EditorError("{} 元素不能包含文本".format(kind))
        if kind != "g" and len(element):
            raise EditorError("{} 元素不支持子元素".format(kind))
        children = []
        for child in element:
            if child.tail and child.tail.strip():
                raise EditorError("图形之间不能包含游离文本")
            children.append(convert(child, depth + 1))
        node = Node(kind, identifier, attrs, children,
                    element.text or "" if kind == "text" else "")
        node.validate()
        return node

    if root.text and root.text.strip():
        raise EditorError("根 SVG 不能包含游离文本")
    for element in root:
        if element.tail and element.tail.strip():
            raise EditorError("图形之间不能包含游离文本")
        document.children.append(convert(element, 1))
    document.validate()
    return document


def serialize_svg(document):
    document.validate()
    root_attrs = {"width": fmt(document.width), "height": fmt(document.height), "version": "1.1"}
    if document.viewbox is not None:
        root_attrs["viewBox"] = document.viewbox
    root_attrs.update(document.attrs)
    root = ET.Element("{" + SVG_NAMESPACE + "}svg", root_attrs)

    def append(parent, node):
        element = ET.SubElement(parent, "{" + SVG_NAMESPACE + "}" + node.kind,
                                dict({"id": node.identifier}, **node.attrs))
        if node.kind == "text":
            element.text = node.text
        for child in node.children:
            append(element, child)

    for node in document.children:
        append(root, node)
    # Do not indent XML: automatic pretty printing can modify whitespace-only text.
    return ET.tostring(root, encoding="utf-8", xml_declaration=True).decode("utf-8") + "\n"


def load_svg(path):
    try:
        with Path(path).open("rb") as stream:
            data = stream.read(MAX_FILE_BYTES + 1)
        if len(data) > MAX_FILE_BYTES:
            raise EditorError("SVG 文件不能超过 5 MiB")
        return parse_svg(data.decode("utf-8-sig"))
    except (OSError, UnicodeError) as exc:
        raise EditorError("读取失败：{}".format(exc)) from exc


def save_svg(document, path):
    content = serialize_svg(document)
    destination = Path(path)
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", newline="\n",
                                         dir=destination.parent, prefix=".svg-editor-",
                                         suffix=".tmp", delete=False) as stream:
            temporary = Path(stream.name)
            stream.write(content)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(str(temporary), str(destination))
    except (OSError, ValueError) as exc:
        raise EditorError("保存失败：{}".format(exc)) from exc
    finally:
        if temporary is not None and temporary.exists():
            temporary.unlink()
