export class EditorError extends Error {
  constructor(message: string) {
    // Errors are always rendered as one terminal line.
    super(message.replace(/[\r\n]+/g, " "));
    this.name = "EditorError";
  }
}
