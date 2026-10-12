import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class GroupCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string, private readonly members: readonly string[]) { super(session); }
  protected override apply(document: Document): string {
    document.group(this.id, this.members); return `g#${this.id} created with ${this.members.length} children`;
  }
}
