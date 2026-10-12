import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class BackCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string) { super(session); }
  protected override apply(document: Document): string { document.reorder(this.id, false); return `${document.find(this.id).label} sent to back`; }
}
