"""SVG affine transforms: matrix(a b c d e f), applied to column vectors."""

import math
import re

from .errors import EditorError

IDENTITY = (1.0, 0.0, 0.0, 1.0, 0.0, 0.0)
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?"


def number(value):
    try:
        result = float(value)
    except (TypeError, ValueError, OverflowError) as exc:
        raise EditorError("需要合法数值：{}".format(value)) from exc
    if not math.isfinite(result):
        raise EditorError("数值必须有限，不能使用 NaN 或 Infinity")
    return result


def fmt(value):
    value = number(value)
    return format(value, ".17g") if value != 0 else "0"


def numbers(source):
    """Parse an SVG number list; reject junk and malformed separators."""
    source = source.strip()
    if not source:
        return []
    pattern = r"{}(?:[\s,]+{})*".format(NUMBER, NUMBER)
    if not re.fullmatch(pattern, source) or re.search(r",\s*,", source):
        raise EditorError("无效的数值列表：{}".format(source))
    return [number(token) for token in re.findall(NUMBER, source)]


def multiply(left, right):
    a, b, c, d, e, f = left
    g, h, i, j, k, l = right
    result = (a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j,
              a*k+c*l+e, b*k+d*l+f)
    return tuple(number(x) for x in result)


def translation(dx, dy):
    return (1.0, 0.0, 0.0, 1.0, number(dx), number(dy))


def scaling(sx, sy, cx=0, cy=0):
    sx, sy, cx, cy = map(number, (sx, sy, cx, cy))
    if sx <= 0 or sy <= 0:
        raise EditorError("缩放比例必须大于 0")
    return multiply(translation(cx, cy),
                    multiply((sx, 0, 0, sy, 0, 0), translation(-cx, -cy)))


def matrix_text(matrix):
    return "matrix({})".format(" ".join(fmt(x) for x in matrix))


def parse_transform(source):
    result = IDENTITY
    remaining = source.strip()
    while remaining:
        match = re.match(r"([A-Za-z]+)\s*\(([^()]*)\)", remaining)
        if not match:
            raise EditorError("无效的 transform：{}".format(source))
        kind, args = match.group(1), numbers(match.group(2))
        if kind == "matrix" and len(args) == 6:
            matrix = tuple(args)
        elif kind == "translate" and len(args) in (1, 2):
            matrix = translation(args[0], args[1] if len(args) == 2 else 0)
        elif kind == "scale" and len(args) in (1, 2):
            # Imported SVG may legitimately contain zero or negative scales.
            matrix = (args[0], 0, 0, args[-1], 0, 0)
        elif kind == "rotate" and len(args) in (1, 3):
            radians = math.radians(args[0])
            cosine, sine = math.cos(radians), math.sin(radians)
            matrix = (cosine, sine, -sine, cosine, 0, 0)
            if len(args) == 3:
                matrix = multiply(translation(args[1], args[2]), multiply(
                    matrix, translation(-args[1], -args[2])))
        elif kind in ("skewX", "skewY") and len(args) == 1:
            tangent = math.tan(math.radians(args[0]))
            matrix = ((1, 0, tangent, 1, 0, 0) if kind == "skewX"
                      else (1, tangent, 0, 1, 0, 0))
        else:
            raise EditorError("不支持的变换或参数数量：{}".format(kind))
        result = multiply(result, matrix)
        remaining = remaining[match.end():]
        if remaining and not re.match(r"[\s,]", remaining):
            raise EditorError("变换之间需要空格或逗号")
        remaining = remaining.lstrip(" \t\r\n,")
    return result
