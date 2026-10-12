import { AffineTransform } from "./AffineTransform";
import { EditorError } from "./EditorError";
import type { ShapeContainer } from "./ShapeContainer";
import { ValueRules } from "./ValueRules";

/** Rich polymorphic model: state is private; operations enforce constraints. */
export abstract class Shape {
  private readonly geometry = new Map<string, number>();
  private readonly appearance = new Map<string, string>();
  private owner: ShapeContainer | undefined;
  private transform: AffineTransform | undefined;
  protected readonly editableGeometry: ReadonlySet<string>;
  private static readonly commonEditable = new Set(["fill", "stroke", "stroke-width"]);
  private static readonly importedAppearance = new Set([
    "fill", "stroke", "stroke-width", "opacity", "fill-opacity", "stroke-opacity",
    "font-size", "font-family", "font-weight", "text-anchor", "stroke-linecap",
    "stroke-linejoin", "stroke-dasharray", "fill-rule",
  ]);

  protected constructor(private readonly identifier: string, geometry: Record<string, number>,
                        editableGeometry: readonly string[], private readonly dimensions: ReadonlySet<string> = new Set()) {
    ValueRules.id(identifier);
    this.editableGeometry = new Set(editableGeometry);
    for (const [key, value] of Object.entries(geometry)) this.assignGeometry(key, value);
  }

  abstract get type(): string;
  abstract move(dx: number, dy: number): void;
  abstract clone(): Shape;
  abstract summary(): string;
  get id(): string { return this.identifier; }
  get label(): string { return `${this.type}#${this.id}`; }
  get parent(): ShapeContainer | undefined { return this.owner; }
  asContainer(): ShapeContainer | undefined { return undefined; }
  descendants(): readonly Shape[] { return []; }

  /** @internal Container ownership is changed only by insert/remove. */
  bindParent(parent: ShapeContainer | undefined): void {
    if (parent && this.owner) throw new EditorError(`shape already has a parent: ${this.id}`);
    this.owner = parent;
  }

  protected value(key: string): number { return this.geometry.get(key) ?? 0; }
  protected assignGeometry(key: string, value: string | number): void {
    const result = this.dimensions.has(key) ? ValueRules.nonnegative(value, key) : ValueRules.number(value);
    this.geometry.set(key, result);
  }
  protected offset(xKeys: readonly string[], yKeys: readonly string[], dx: number, dy: number): void {
    for (const key of xKeys) this.assignGeometry(key, this.value(key) + dx);
    for (const key of yKeys) this.assignGeometry(key, this.value(key) + dy);
  }

  scale(factor: number): void {
    ValueRules.positive(factor, "scale factor must be positive");
    for (const [key, value] of this.geometry) this.assignGeometry(key, value * factor);
  }

  set(attribute: string, value: string): void {
    if (this.editableGeometry.has(attribute)) this.assignGeometry(attribute, value);
    else if (Shape.commonEditable.has(attribute)) this.setAppearance(attribute, value);
    else throw new EditorError(`unknown attribute: ${attribute}`);
  }

  private setAppearance(key: string, value: string): void {
    ValueRules.xmlText(value);
    if (["stroke-width", "font-size"].includes(key)) ValueRules.nonnegative(value, key);
    if (["opacity", "fill-opacity", "stroke-opacity"].includes(key)) {
      const alpha = ValueRules.number(value);
      if (alpha < 0 || alpha > 1) throw new EditorError(`${key} must be between 0 and 1`);
    }
    this.appearance.set(key, value);
  }

  loadSvgAttributes(attributes: Readonly<Record<string, string>>): void {
    for (const [key, value] of Object.entries(attributes)) {
      if (key === "id") continue;
      if (this.geometry.has(key)) {
        this.assignGeometry(key, value.endsWith("px") ? value.slice(0, -2) : value);
      } else if (Shape.importedAppearance.has(key)) this.setAppearance(key, value);
      else if (key === "transform") this.transform = AffineTransform.parse(value);
      else throw new EditorError(`unsupported SVG attribute: ${key}`);
    }
  }
  acceptSvgText(text: string): void {
    if (text.trim()) throw new EditorError(`${this.type} cannot contain text`);
  }

  protected copyAppearanceTo(target: Shape): void {
    for (const [key, value] of this.appearance) target.appearance.set(key, value);
    target.transform = this.transform;
  }

  inheritFrom(group: Shape): void {
    for (const [key, value] of group.appearance) {
      if (key !== "opacity" && !this.appearance.has(key)) this.appearance.set(key, value);
    }
    if (group.transform) this.transform = group.transform.multiply(this.transform ?? AffineTransform.identity());
  }

  attribute(key: string): string | undefined {
    if (this.geometry.has(key)) return String(this.value(key));
    return this.appearance.get(key);
  }

  private static relativeWeight(value: string, inherited: number): number {
    if (value === "normal") return 400;
    if (value === "bold") return 700;
    if (value === "bolder") return inherited < 400 ? 400 : inherited < 600 ? 700 : 900;
    if (value === "lighter") return inherited < 600 ? 100 : inherited < 800 ? 400 : 700;
    return ValueRules.number(value);
  }

  computedFontWeight(): number {
    const inherited = this.parent?.asShape()?.computedFontWeight() ?? 400;
    const own = this.appearance.get("font-weight");
    return own === undefined ? inherited : Shape.relativeWeight(own, inherited);
  }

  freezeRelativeFontWeight(): void {
    if (["bolder", "lighter"].includes(this.appearance.get("font-weight") ?? "")) {
      this.appearance.set("font-weight", String(this.computedFontWeight()));
    }
  }

  protected paintSummary(): string {
    return [...this.appearance].map(([key, value]) => `${key}=${value}`).join(" ");
  }
  protected contentSvg(): string { return ""; }
  toSvg(): string {
    const attrs = new Map<string, string>([["id", this.id], ...[...this.geometry].map(
      ([key, value]): [string, string] => [key, String(value)]), ...this.appearance]);
    if (this.transform) attrs.set("transform", this.transform.toSvg());
    const text = [...attrs].map(([key, value]) => ` ${key}="${ValueRules.escape(value)}"`).join("");
    const content = this.contentSvg();
    return content ? `<${this.type}${text}>${content}</${this.type}>` : `<${this.type}${text}/>`;
  }
  show(): string {
    const properties = [...this.geometry].map(([key, value]) => `${key}=${value}`).join(" ");
    return `${this.label}  parent=${this.parent?.label ?? "(detached)"}\n` +
      [properties, this.paintSummary(), this.transform ? `transform=${this.transform.toSvg()}` : ""]
        .filter(Boolean).map(line => `  ${line}`).join("\n");
  }
}
