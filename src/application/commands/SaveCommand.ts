import type { DocumentSession } from "../DocumentSession";
import { SessionCommand } from "../SessionCommand";

export class SaveCommand extends SessionCommand {
  constructor(session: DocumentSession, private readonly path?: string) { super(session); }
  override get blocksHistory(): boolean { return true; }
  override execute(): string { return this.session.save(this.path); }
}
