import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class FrontCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string) { super(session); }
  protected override apply(document: Document): string { document.reorder(this.id, true); return `${document.find(this.id).label} brought to front`; }
}
