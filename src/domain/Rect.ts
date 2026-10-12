import { Shape } from "./Shape";

export class Rect extends Shape {
  constructor(id: string, x: number, y: number, width: number, height: number, rx = 0, ry = 0) {
    super(id, { x, y, width, height, rx, ry }, ["x", "y", "width", "height"], new Set(["width", "height", "rx", "ry"]));
  }
  override get type(): string { return "rect"; }
  protected override get position(): readonly [number, number] { return [this.value("x"), this.value("y")]; }
  override move(dx: number, dy: number): void { this.offset(["x"], ["y"], dx, dy); }
  override clone(): Rect {
    const result = new Rect(this.id, this.value("x"), this.value("y"), this.value("width"), this.value("height"), this.value("rx"), this.value("ry"));
    this.copyAppearanceTo(result);
    return result;
  }
  override summary(): string {
    return `${this.label}  x=${this.value("x")} y=${this.value("y")} w=${this.value("width")} h=${this.value("height")} ${this.paintSummary()}`.trimEnd();
  }
}
