import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class UngroupCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string) { super(session); }
  protected override apply(document: Document): string { document.ungroup(this.id); return `g#${this.id} ungrouped`; }
}
