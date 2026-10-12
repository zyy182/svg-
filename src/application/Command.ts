import type { DocumentSession } from "./DocumentSession";

export abstract class Command {
  protected constructor(protected readonly session: DocumentSession) {}
  get undoable(): boolean { return false; }
  get blocksHistory(): boolean { return false; }
  abstract execute(): string;
  abstract undo(): string;
  abstract redo(): string;
}
