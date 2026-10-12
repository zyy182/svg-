import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class AddToCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly group: string, private readonly id: string) { super(session); }
  protected override apply(document: Document): string {
    document.addTo(this.group, this.id); return `${document.find(this.id).label} moved into ${document.container(this.group).label}`;
  }
}
