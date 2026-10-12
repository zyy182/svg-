import { SessionCommand } from "../SessionCommand";

export class RedoCommand extends SessionCommand {
  override execute(): string { return this.session.redo(); }
}
