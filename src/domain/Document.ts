import { EditorError } from "./EditorError";
import { Group } from "./Group";
import type { Shape } from "./Shape";
import type { ShapeContainer } from "./ShapeContainer";
import { ValueRules } from "./ValueRules";

export class Document implements ShapeContainer {
  private readonly items: Shape[] = [];
  private viewBox: string;
  constructor(private width: number = 800, private height: number = 600) {
    this.resize(width, height); this.viewBox = `0 0 ${width} ${height}`;
  }
  get children(): readonly Shape[] { return Object.freeze([...this.items]); }
  get parent(): undefined { return undefined; }
  get label(): string { return "svg"; }
  asShape(): undefined { return undefined; }
  get size(): readonly [number, number] { return [this.width, this.height]; }
  resize(width: number, height: number): void {
    const w = ValueRules.positive(width, "canvas width must be positive");
    const h = ValueRules.positive(height, "canvas height must be positive");
    this.width = w; this.height = h; this.viewBox = `0 0 ${w} ${h}`;
  }
  setViewBox(value: string): void {
    if (/,\s*,|^,|,$/.test(value.trim())) throw new EditorError("invalid viewBox");
    const numbers = value.trim().split(/[\s,]+/).map(v => ValueRules.number(v));
    if (numbers.length !== 4 || numbers[2]! <= 0 || numbers[3]! <= 0) throw new EditorError("invalid viewBox");
    this.viewBox = numbers.join(" ");
  }
  insert(shape: Shape, index = this.items.length): void {
    if (!Number.isInteger(index) || index < 0 || index > this.items.length) throw new EditorError("invalid insertion index");
    this.ensureAvailable(shape.id);
    shape.parent?.remove(shape); this.items.splice(Math.min(index, this.items.length), 0, shape); shape.bindParent(this);
  }
  remove(shape: Shape): void {
    const index = this.items.indexOf(shape);
    if (index < 0) throw new EditorError(`no such child: ${shape.id}`);
    this.items.splice(index, 1); shape.bindParent(undefined);
  }
  all(): readonly Shape[] { return this.items.flatMap(shape => [shape, ...shape.descendants()]); }
  find(id: string): Shape {
    const result = this.all().find(shape => shape.id === id);
    if (!result) throw new EditorError(`no such shape: ${id}`);
    return result;
  }
  container(id: string): ShapeContainer {
    const shape = this.all().find(item => item.id === id);
    if (!shape) throw new EditorError(`no such container: ${id}`);
    const container = shape.asContainer();
    if (!container) throw new EditorError(`not a container: ${id}`);
    return container;
  }
  ensureAvailable(id: string): void {
    ValueRules.id(id);
    if (this.all().some(shape => shape.id === id)) throw new EditorError(`id already exists: ${id}`);
  }
  add(shape: Shape, parentId?: string): void {
    this.ensureAvailable(shape.id);
    (parentId === undefined ? this : this.container(parentId)).insert(shape);
  }
  delete(id: string): void { const shape = this.find(id); shape.parent!.remove(shape); }
  addTo(groupId: string, id: string): void {
    const container = this.container(groupId), shape = this.find(id);
    container.insert(shape);
  }
  private ancestors(container: ShapeContainer): ShapeContainer[] {
    const result: ShapeContainer[] = [];
    for (let current: ShapeContainer | undefined = container; current; current = current.parent) result.push(current);
    return result;
  }
  group(id: string, members: readonly string[]): void {
    this.ensureAvailable(id);
    if (members.length === 0 || new Set(members).size !== members.length) throw new EditorError("group requires distinct members");
    const selected = members.map(member => this.find(member));
    for (const ancestor of selected) {
      if (selected.some(other => other !== ancestor && ancestor.descendants().includes(other))) {
        throw new EditorError(`cannot group a container into its own descendant: ${ancestor.id}`);
      }
    }
    const ordered = this.all().filter(shape => selected.includes(shape));
    const ancestors = this.ancestors(ordered[0]!.parent!);
    const parent = ancestors.find(candidate => ordered.every(shape => this.ancestors(shape.parent!).includes(candidate)))!;
    const branchIndexes = ordered.map(shape => {
      let branch = shape;
      while (branch.parent !== parent) branch = branch.parent!.asShape()!;
      return parent.children.indexOf(branch);
    });
    const insertion = Math.min(...branchIndexes);
    const directBefore = ordered.filter(shape => shape.parent === parent && parent.children.indexOf(shape) < insertion).length;
    const group = new Group(id);
    for (const shape of ordered) group.insert(shape);
    parent.insert(group, insertion - directBefore);
  }
  ungroup(id: string): void {
    const shape = this.find(id), container = shape.asContainer();
    if (!container) throw new EditorError(`not a container: ${id}`);
    const parent = shape.parent!;
    if (parent === this) throw new EditorError(`cannot ungroup top-level container: ${id}`);
    if (Number(shape.attribute("opacity") ?? 1) !== 1) throw new EditorError(`cannot preserve group opacity when ungrouping: ${id}`);
    const index = parent.children.indexOf(shape);
    const children = [...container.children];
    for (const child of children) { child.freezeRelativeFontWeight(); child.inheritFrom(shape); }
    parent.remove(shape);
    children.forEach((child, offset) => parent.insert(child, index + offset));
  }
  reorder(id: string, front: boolean): void {
    const shape = this.find(id), parent = shape.parent!;
    parent.remove(shape); parent.insert(shape, front ? parent.children.length : 0);
  }
  validate(): void {
    const ids = new Set<string>(), visited = new Set<Shape>();
    const visit = (parent: ShapeContainer, depth: number): void => {
      for (const shape of parent.children) {
        if (depth > 128 || ids.size >= 10000) throw new EditorError("document limit exceeded (10000 elements, depth 128)");
        if (visited.has(shape) || shape.parent !== parent) throw new EditorError("invalid document ownership");
        if (ids.has(shape.id)) throw new EditorError(`id already exists: ${shape.id}`);
        ids.add(shape.id); visited.add(shape);
        const container = shape.asContainer(); if (container) visit(container, depth + 1);
      }
    };
    visit(this, 1);
  }
  clone(): Document {
    const result = new Document(this.width, this.height); result.viewBox = this.viewBox;
    for (const shape of this.items) result.insert(shape.clone());
    return result;
  }
  toSvg(): string {
    this.validate();
    return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="${this.width}" height="${this.height}" viewBox="${ValueRules.escape(this.viewBox)}">${this.items.map(shape => shape.toSvg()).join("")}</svg>\n`;
  }
  tree(id?: string): string {
    const lines: string[] = [];
    const visit = (shape: Shape, prefix: string, connector: string): void => {
      lines.push(prefix + connector + shape.summary());
      const children = shape.asContainer()?.children ?? [];
      const nextPrefix = prefix + (connector === "" ? "" : connector === "└── " ? "    " : "│   ");
      children.forEach((child, index) => visit(child, nextPrefix, index === children.length - 1 ? "└── " : "├── "));
    };
    if (id !== undefined) visit(this.find(id), "", "");
    else {
      lines.push(`svg (${this.width}x${this.height})`);
      this.items.forEach((child, index) => visit(child, "", index === this.items.length - 1 ? "└── " : "├── "));
    }
    return lines.join("\n");
  }
}
