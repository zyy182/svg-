import { Shape } from "./Shape";

export class Line extends Shape {
  constructor(id: string, x1: number, y1: number, x2: number, y2: number) {
    super(id, { x1, y1, x2, y2 }, ["x1", "y1", "x2", "y2"]);
  }
  override get type(): string { return "line"; }
  override move(dx: number, dy: number): void { this.offset(["x1", "x2"], ["y1", "y2"], dx, dy); }
  override clone(): Line {
    const result = new Line(this.id, this.value("x1"), this.value("y1"), this.value("x2"), this.value("y2"));
    this.copyAppearanceTo(result); return result;
  }
  override summary(): string {
    return `${this.label}  (${this.value("x1")},${this.value("y1")}) -> (${this.value("x2")},${this.value("y2")}) ${this.paintSummary()}`.trimEnd();
  }
}
