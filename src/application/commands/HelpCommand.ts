import type { DocumentSession } from "../DocumentSession";
import { SessionCommand } from "../SessionCommand";

export class HelpCommand extends SessionCommand {
  constructor(session: DocumentSession, private readonly usage: string) { super(session); }
  override execute(): string { return this.usage; }
}
