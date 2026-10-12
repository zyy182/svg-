import { Shape } from "./Shape";

export class Circle extends Shape {
  constructor(id: string, cx: number, cy: number, r: number) {
    super(id, { cx, cy, r }, ["cx", "cy", "r"], new Set(["r"]));
  }
  override get type(): string { return "circle"; }
  override move(dx: number, dy: number): void { this.offset(["cx"], ["cy"], dx, dy); }
  override clone(): Circle {
    const result = new Circle(this.id, this.value("cx"), this.value("cy"), this.value("r"));
    this.copyAppearanceTo(result); return result;
  }
  override summary(): string {
    return `${this.label}  cx=${this.value("cx")} cy=${this.value("cy")} r=${this.value("r")} ${this.paintSummary()}`.trimEnd();
  }
}
