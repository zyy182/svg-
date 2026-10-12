import { Circle } from "./Circle";
import { Ellipse } from "./Ellipse";
import { EditorError } from "./EditorError";
import { Group } from "./Group";
import { Line } from "./Line";
import { Rect } from "./Rect";
import type { Shape } from "./Shape";
import { Text } from "./Text";
import { ValueRules } from "./ValueRules";

/** The only shape-name dispatch; replace registrations with providers in Phase 2. */
export class ShapeFactory {
  private readonly creators = new Map<string, (id: string, args: readonly string[]) => Shape>([
    ["rect", (id, args) => {
      this.count(args, [4, 5], "rect");
      const shape = new Rect(id, this.numeric(args[0]), this.numeric(args[1]), this.numeric(args[2]), this.numeric(args[3]));
      if (args[4] !== undefined) shape.set("fill", args[4]); return shape;
    }],
    ["circle", (id, args) => {
      this.count(args, [3, 4], "circle");
      const shape = new Circle(id, this.numeric(args[0]), this.numeric(args[1]), this.numeric(args[2]));
      if (args[3] !== undefined) shape.set("fill", args[3]); return shape;
    }],
    ["ellipse", (id, args) => {
      this.count(args, [4, 5], "ellipse");
      const shape = new Ellipse(id, this.numeric(args[0]), this.numeric(args[1]), this.numeric(args[2]), this.numeric(args[3]));
      if (args[4] !== undefined) shape.set("fill", args[4]); return shape;
    }],
    ["line", (id, args) => {
      this.count(args, [4, 5], "line");
      const shape = new Line(id, this.numeric(args[0]), this.numeric(args[1]), this.numeric(args[2]), this.numeric(args[3]));
      if (args[4] !== undefined) shape.set("stroke", args[4]); return shape;
    }],
    ["text", (id, args) => {
      this.count(args, [3], "text"); return new Text(id, this.numeric(args[0]), this.numeric(args[1]), args[2]!);
    }],
    ["g", (id, args) => { this.count(args, [0], "g"); return new Group(id); }],
  ]);
  private readonly readers = new Map<string, (id: string, attrs: Readonly<Record<string, string>>, text: string) => Shape>([
    ["rect", (id, a) => new Rect(id, this.svgNumber(a, "x"), this.svgNumber(a, "y"), this.svgNumber(a, "width"), this.svgNumber(a, "height"),
      this.svgNumber(a, "rx", this.svgNumber(a, "ry")), this.svgNumber(a, "ry", this.svgNumber(a, "rx")))],
    ["circle", (id, a) => new Circle(id, this.svgNumber(a, "cx"), this.svgNumber(a, "cy"), this.svgNumber(a, "r"))],
    ["ellipse", (id, a) => new Ellipse(id, this.svgNumber(a, "cx"), this.svgNumber(a, "cy"), this.svgNumber(a, "rx"), this.svgNumber(a, "ry"))],
    ["line", (id, a) => new Line(id, this.svgNumber(a, "x1"), this.svgNumber(a, "y1"), this.svgNumber(a, "x2"), this.svgNumber(a, "y2"))],
    ["text", (id, a, text) => new Text(id, this.svgNumber(a, "x"), this.svgNumber(a, "y"), text)],
    ["g", id => new Group(id)],
  ]);
  private numeric(value: string | undefined): number { return ValueRules.number(value ?? ""); }
  private count(args: readonly string[], lengths: readonly number[], type: string): void {
    if (!lengths.includes(args.length)) throw new EditorError(`invalid parameters for ${type}. use 'help'`);
  }
  private svgNumber(attrs: Readonly<Record<string, string>>, key: string, fallback = 0): number {
    const value = attrs[key]; return value === undefined ? fallback : this.numeric(value.endsWith("px") ? value.slice(0, -2) : value);
  }
  private unknown(type: string): never { throw new EditorError(`unknown shape type: ${type} (is the plugin loaded?)`); }
  create(type: string, id: string, args: readonly string[]): Shape {
    const creator = this.creators.get(type); if (!creator) return this.unknown(type);
    return creator(id, args);
  }
  fromSvg(type: string, id: string, attrs: Readonly<Record<string, string>>, text: string): Shape {
    const reader = this.readers.get(type); if (!reader) return this.unknown(type);
    const shape = reader(id, attrs, text); shape.loadSvgAttributes(attrs); return shape;
  }
}
