import { EditorError } from "../domain/EditorError";
import { Command } from "./Command";
import type { DocumentSession } from "./DocumentSession";

export abstract class SessionCommand extends Command {
  constructor(session: DocumentSession) { super(session); }
  override undo(): never { throw new EditorError("command is not undoable"); }
  override redo(): never { throw new EditorError("command is not redoable"); }
}
