/** Parser intermediate, never used as the editable domain model. */
export class SvgElement {
  private readonly items: SvgElement[] = [];
  private content = "";
  constructor(private readonly tag: string, private readonly attrs: Readonly<Record<string, string>>) {}
  get name(): string { return this.tag; }
  get attributes(): Readonly<Record<string, string>> { return this.attrs; }
  get children(): readonly SvgElement[] { return this.items; }
  get text(): string { return this.content; }
  addChild(child: SvgElement): void { this.items.push(child); }
  appendText(text: string): void { this.content += text; }
  all(): readonly SvgElement[] { return [this, ...this.items.flatMap(child => child.all())]; }
}
