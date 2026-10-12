import { EditorError } from "../domain/EditorError";
import { ValueRules } from "../domain/ValueRules";

export class Arguments {
  constructor(private readonly values: readonly string[]) {}
  expect(lengths: readonly number[]): void {
    if (!lengths.includes(this.values.length)) throw new EditorError("invalid arguments. use 'help' for syntax");
  }
  at(index: number): string {
    const value = this.values[index]; if (value === undefined) throw new EditorError("missing argument. use 'help' for syntax");
    return value;
  }
  optional(index: number): string | undefined { return this.values[index]; }
  number(index: number): number { return ValueRules.number(this.at(index)); }
  slice(index: number): readonly string[] { return this.values.slice(index); }
  get length(): number { return this.values.length; }
  withParent(): { parameters: Arguments; parent?: string } {
    if (this.values.length >= 2 && this.values.at(-2) === "in") {
      return { parameters: new Arguments(this.values.slice(0, -2)), parent: this.values.at(-1)! };
    }
    return { parameters: this };
  }
}
