import type { Document } from "../../domain/Document";
import type { ShapeFactory } from "../../domain/ShapeFactory";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class CreateCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly factory: ShapeFactory, private readonly type: string,
              private readonly id: string, private readonly args: readonly string[], private readonly parent?: string) { super(session); }
  protected override apply(document: Document): string {
    document.ensureAvailable(this.id);
    const shape = this.factory.create(this.type, this.id, this.args); document.add(shape, this.parent);
    return `${shape.label} created${this.parent === undefined ? "" : ` in ${document.container(this.parent).label}`}`;
  }
}
