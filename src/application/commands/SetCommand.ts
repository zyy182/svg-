import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class SetCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string, private readonly attribute: string, private readonly value: string) { super(session); }
  private feedback(document: Document): string {
    const shape = document.find(this.id); return `${shape.label} updated: ${this.attribute}=${JSON.stringify(shape.attribute(this.attribute))}`;
  }
  protected override apply(document: Document): string {
    document.find(this.id).set(this.attribute, this.value); return this.feedback(document);
  }
  protected override undoFeedback(document: Document): string { return this.feedback(document); }
}
