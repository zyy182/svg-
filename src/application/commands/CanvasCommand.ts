import type { DocumentSession } from "../DocumentSession";
import { SessionCommand } from "../SessionCommand";

export class CanvasCommand extends SessionCommand {
  constructor(session: DocumentSession, private readonly width?: number, private readonly height?: number) { super(session); }
  override get blocksHistory(): boolean { return this.width !== undefined; }
  override execute(): string {
    const [w, h] = this.session.requireDocument().size;
    return this.width === undefined ? `canvas ${w}x${h}` : this.session.resize(this.width, this.height ?? h);
  }
}
