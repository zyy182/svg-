import { Shape } from "./Shape";

export class Ellipse extends Shape {
  constructor(id: string, cx: number, cy: number, rx: number, ry: number) {
    super(id, { cx, cy, rx, ry }, ["cx", "cy", "rx", "ry"], new Set(["rx", "ry"]));
  }
  override get type(): string { return "ellipse"; }
  protected override get position(): readonly [number, number] { return [this.value("cx"), this.value("cy")]; }
  override move(dx: number, dy: number): void { this.offset(["cx"], ["cy"], dx, dy); }
  override clone(): Ellipse {
    const result = new Ellipse(this.id, this.value("cx"), this.value("cy"), this.value("rx"), this.value("ry"));
    this.copyAppearanceTo(result); return result;
  }
  override summary(): string {
    return `${this.label}  cx=${this.value("cx")} cy=${this.value("cy")} rx=${this.value("rx")} ry=${this.value("ry")} ${this.paintSummary()}`.trimEnd();
  }
}
