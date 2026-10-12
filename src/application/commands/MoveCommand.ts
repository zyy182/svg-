import type { Document } from "../../domain/Document";
import type { DocumentSession } from "../DocumentSession";
import { EditCommand } from "../EditCommand";

export class MoveCommand extends EditCommand {
  constructor(session: DocumentSession, private readonly id: string, private readonly dx: number, private readonly dy: number) { super(session); }
  protected override apply(document: Document): string {
    const shape = document.find(this.id); shape.move(this.dx, this.dy); return shape.movementFeedback(this.dx, this.dy);
  }
  protected override undoFeedback(document: Document): string { return document.find(this.id).movementFeedback(-this.dx, -this.dy, true); }
}
