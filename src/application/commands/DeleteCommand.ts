import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class DeleteCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string) { super(session); }
  protected override apply(document: Document): string {
    const label = document.find(this.id).label; document.delete(this.id); return `${label} deleted`;
  }
  protected override undoFeedback(document: Document): string {
    const shape = document.find(this.id); return `${shape.label} restored into ${shape.parent!.label}`;
  }
}
