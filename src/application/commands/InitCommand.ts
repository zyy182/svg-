import type { DocumentSession } from "../DocumentSession";
import { SessionCommand } from "../SessionCommand";

export class InitCommand extends SessionCommand {
  constructor(session: DocumentSession, private readonly width = 800, private readonly height = 600) { super(session); }
  override get blocksHistory(): boolean { return true; }
  override execute(): string { return this.session.init(this.width, this.height); }
}
