import { SessionCommand } from "../SessionCommand";

export class QuitCommand extends SessionCommand {
  override execute(): string { return this.session.quit(); }
}
