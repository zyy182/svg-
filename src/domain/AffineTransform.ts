import { EditorError } from "./EditorError";
import { ValueRules } from "./ValueRules";

/** Preserved SVG transforms; command move/scale operate on shape geometry. */
export class AffineTransform {
  private constructor(private readonly values: readonly number[]) {}

  static identity(): AffineTransform { return new AffineTransform([1, 0, 0, 1, 0, 0]); }

  multiply(right: AffineTransform): AffineTransform {
    const [a, b, c, d, e, f] = this.values as [number, number, number, number, number, number];
    const [g, h, i, j, k, l] = right.values as [number, number, number, number, number, number];
    return new AffineTransform([a*g+c*h, b*g+d*h, a*i+c*j, b*i+d*j,
      a*k+c*l+e, b*k+d*l+f].map(value => ValueRules.number(value)));
  }

  toSvg(): string { return `matrix(${this.values.join(" ")})`; }

  static parse(source: string): AffineTransform {
    let remaining = source.trim();
    let result = this.identity();
    while (remaining) {
      const match = /^([A-Za-z]+)\s*\(([^()]*)\)/.exec(remaining);
      if (!match) throw new EditorError("invalid SVG transform");
      const text = match[2]!.trim();
      if (!text || /,\s*,|^,|,$/.test(text)) throw new EditorError("invalid SVG transform");
      const args = text.split(/[\s,]+/).map(value => ValueRules.number(value));
      const name = match[1]!;
      let matrix: AffineTransform;
      // This is an SVG transform grammar, not a shape type dispatch.
      if (name === "matrix" && args.length === 6) matrix = new AffineTransform(args);
      else if (name === "translate" && [1, 2].includes(args.length)) {
        matrix = new AffineTransform([1, 0, 0, 1, args[0]!, args[1] ?? 0]);
      } else if (name === "scale" && [1, 2].includes(args.length)) {
        matrix = new AffineTransform([args[0]!, 0, 0, args[1] ?? args[0]!, 0, 0]);
      } else if (name === "rotate" && [1, 3].includes(args.length)) {
        const angle = args[0]! * Math.PI / 180;
        matrix = new AffineTransform([Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0]);
        if (args.length === 3) {
          const x = args[1]!, y = args[2]!;
          matrix = new AffineTransform([1, 0, 0, 1, x, y]).multiply(matrix)
            .multiply(new AffineTransform([1, 0, 0, 1, -x, -y]));
        }
      } else if ((name === "skewX" || name === "skewY") && args.length === 1) {
        const tangent = Math.tan(args[0]! * Math.PI / 180);
        matrix = new AffineTransform(name === "skewX" ? [1, 0, tangent, 1, 0, 0] : [1, tangent, 0, 1, 0, 0]);
      } else throw new EditorError("invalid SVG transform");
      result = result.multiply(matrix);
      remaining = remaining.slice(match[0].length);
      if (remaining.trim()) {
        const separator = /^\s*(?:,\s*|\s+)/.exec(remaining);
        if (!separator) throw new EditorError("invalid SVG transform");
        remaining = remaining.slice(separator[0].length);
        if (!remaining || remaining.startsWith(",")) throw new EditorError("invalid SVG transform");
      } else remaining = "";
    }
    return result;
  }
}
