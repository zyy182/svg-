import type { DocumentSession } from "../DocumentSession";
import { SessionCommand } from "../SessionCommand";

export class TreeCommand extends SessionCommand {
  constructor(session: DocumentSession, private readonly id?: string) { super(session); }
  override execute(): string { return this.session.requireDocument().tree(this.id); }
}
