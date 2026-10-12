import type { Document } from "../../domain/Document";
import { ValueRules } from "../../domain/ValueRules";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class ScaleCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string, private readonly factor: number) { super(session); }
  protected override apply(document: Document): string {
    ValueRules.positive(this.factor, "scale factor must be positive");
    const shape = document.find(this.id); shape.scale(this.factor); return `${shape.label} scaled by ${this.factor}`;
  }
}
