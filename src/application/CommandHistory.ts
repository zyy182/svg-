import { EditorError } from "../domain/EditorError";
import type { Command } from "./Command";

export class CommandHistory {
  private readonly undoStack: Command[] = [];
  private readonly redoStack: Command[] = [];
  private ioBarrier = false;
  constructor(private readonly limit = 100) {}
  execute(command: Command): string {
    const result = command.execute();
    if (command.undoable) {
      this.undoStack.push(command); if (this.undoStack.length > this.limit) this.undoStack.shift();
      this.redoStack.length = 0; this.ioBarrier = false;
    } else if (command.blocksHistory) this.barrier();
    return result;
  }
  barrier(): void { this.undoStack.length = 0; this.redoStack.length = 0; this.ioBarrier = true; }
  undo(): string {
    if (this.ioBarrier) throw new EditorError("undo not allowed after io command");
    const command = this.undoStack.at(-1); if (!command) throw new EditorError("nothing to undo");
    const result = command.undo(); this.undoStack.pop(); this.redoStack.push(command); return result;
  }
  redo(): string {
    if (this.ioBarrier) throw new EditorError("undo not allowed after io command");
    const command = this.redoStack.at(-1); if (!command) throw new EditorError("nothing to redo");
    const result = command.redo(); this.redoStack.pop(); this.undoStack.push(command); return result;
  }
  get counts(): readonly [number, number] { return [this.undoStack.length, this.redoStack.length]; }
}
