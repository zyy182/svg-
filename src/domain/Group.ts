import { EditorError } from "./EditorError";
import { Shape } from "./Shape";
import type { ShapeContainer } from "./ShapeContainer";

export class Group extends Shape implements ShapeContainer {
  private readonly items: Shape[] = [];
  constructor(id: string) { super(id, {}, []); }
  override get type(): string { return "g"; }
  get children(): readonly Shape[] { return Object.freeze([...this.items]); }
  override asContainer(): ShapeContainer { return this; }
  asShape(): Shape { return this; }
  override descendants(): readonly Shape[] { return this.items.flatMap(child => [child, ...child.descendants()]); }
  insert(shape: Shape, index = this.items.length): void {
    for (let parent: ShapeContainer | undefined = this; parent; parent = parent.parent) {
      if (parent === shape.asContainer()) throw new EditorError(`cannot move a container into its own descendant: ${shape.id}`);
    }
    if (!Number.isInteger(index) || index < 0 || index > this.items.length) throw new EditorError("invalid insertion index");
    shape.parent?.remove(shape);
    this.items.splice(Math.min(index, this.items.length), 0, shape);
    shape.bindParent(this);
  }
  remove(shape: Shape): void {
    const index = this.items.indexOf(shape);
    if (index < 0) throw new EditorError(`no such child: ${shape.id}`);
    this.items.splice(index, 1); shape.bindParent(undefined);
  }
  override move(dx: number, dy: number): void { for (const child of this.items) child.move(dx, dy); }
  override scale(factor: number): void { super.scale(factor); for (const child of this.items) child.scale(factor); }
  override clone(): Group {
    const result = new Group(this.id); this.copyAppearanceTo(result);
    for (const child of this.items) result.insert(child.clone());
    return result;
  }
  override summary(): string { return `${this.label} ${this.paintSummary()}`.trimEnd(); }
  protected override contentSvg(): string { return this.items.map(child => child.toSvg()).join(""); }
}
