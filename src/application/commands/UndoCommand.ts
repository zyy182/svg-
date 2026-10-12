import { SessionCommand } from "../SessionCommand";

export class UndoCommand extends SessionCommand {
  override execute(): string { return this.session.undo(); }
}
