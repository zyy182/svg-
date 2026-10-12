import { EditorError } from "./EditorError";

/** Shared domain constraints; no terminal, file system or type-name dispatch. */
export class ValueRules {
  static number(source: string | number): number {
    const text = String(source).trim();
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) {
      throw new EditorError(`invalid number: ${source}`);
    }
    const result = Number(text);
    if (!Number.isFinite(result)) throw new EditorError(`invalid number: ${source}`);
    return Object.is(result, -0) ? 0 : result;
  }

  static nonnegative(source: string | number, attribute: string): number {
    const result = this.number(source);
    if (result < 0) throw new EditorError(`${attribute} must be nonnegative`);
    return result;
  }

  static positive(source: string | number, message: string): number {
    const result = this.number(source);
    if (result <= 0) throw new EditorError(message);
    return result;
  }

  static id(identifier: string): void {
    if (!/^[A-Za-z_][A-Za-z0-9_.:-]*$/.test(identifier) || identifier === "svg") {
      throw new EditorError(`invalid id: ${identifier}`);
    }
  }

  static xmlText(value: string): void {
    for (const char of value) {
      const code = char.codePointAt(0)!;
      if (!(code === 9 || code === 10 || code === 13 ||
            (code >= 32 && code <= 0xd7ff) || (code >= 0xe000 && code <= 0xfffd) ||
            (code >= 0x10000 && code <= 0x10ffff))) {
        throw new EditorError("invalid XML character");
      }
    }
  }

  static escape(value: string): string {
    this.xmlText(value);
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&apos;")
      .replace(/\r/g, "&#13;").replace(/\n/g, "&#10;").replace(/\t/g, "&#9;");
  }
}
