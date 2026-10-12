import { Shape } from "./Shape";
import { ValueRules } from "./ValueRules";

export class Text extends Shape {
  constructor(id: string, x: number, y: number, private text: string) {
    super(id, { x, y }, ["x", "y"]);
    ValueRules.xmlText(text);
  }
  override get type(): string { return "text"; }
  override move(dx: number, dy: number): void { this.offset(["x"], ["y"], dx, dy); }
  override set(attribute: string, value: string): void {
    if (attribute === "text") { ValueRules.xmlText(value); this.text = value; }
    else super.set(attribute, value);
  }
  override attribute(key: string): string | undefined { return key === "text" ? this.text : super.attribute(key); }
  override acceptSvgText(text: string): void { ValueRules.xmlText(text); this.text = text; }
  override clone(): Text {
    const result = new Text(this.id, this.value("x"), this.value("y"), this.text);
    this.copyAppearanceTo(result); return result;
  }
  override summary(): string { return `${this.label} (${this.value("x")},${this.value("y")}) ${JSON.stringify(this.text)} ${this.paintSummary()}`.trimEnd(); }
  protected override contentSvg(): string { return ValueRules.escape(this.text); }
  override show(): string { return `${super.show()}\n  text=${JSON.stringify(this.text)}`; }
}
