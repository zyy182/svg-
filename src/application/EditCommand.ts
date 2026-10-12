import type { Document } from "../domain/Document";
import { EditorError } from "../domain/EditorError";
import { Command } from "./Command";
import type { DocumentSession } from "./DocumentSession";

/** Each editing object owns its before/after mementos; one object = one unit. */
export abstract class EditCommand extends Command {
  private before: Document | undefined;
  private after: Document | undefined;
  private result = "";
  constructor(session: DocumentSession) { super(session); }
  override get undoable(): boolean { return true; }
  protected abstract apply(document: Document): string;
  protected undoFeedback(_document: Document): string { return `undone: ${this.result}`; }
  override execute(): string {
    const current = this.session.requireDocument();
    const candidate = current.clone();
    const result = this.apply(candidate);
    candidate.validate();
    // Allocate both mementos before publishing any new state.
    const before = current.clone(), after = candidate.clone();
    this.session.replaceForEdit(candidate);
    this.before = before; this.after = after; this.result = result;
    return result;
  }
  override undo(): string {
    if (!this.before) throw new EditorError("command has not been executed");
    this.session.replaceForEdit(this.before.clone());
    return this.undoFeedback(this.before);
  }
  override redo(): string {
    if (!this.after) throw new EditorError("command has not been executed");
    this.session.replaceForEdit(this.after.clone());
    return this.result;
  }
}
