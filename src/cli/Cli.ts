import type { Readable, Writable } from "node:stream";
import { createInterface } from "node:readline";
import type { DocumentSession } from "../application/DocumentSession";
import { EditorError } from "../domain/EditorError";
import { CommandRegistry } from "./CommandRegistry";
import { Tokenizer } from "./Tokenizer";

export class Cli {
  private readonly tokenizer = new Tokenizer();
  private readonly registry: CommandRegistry;
  constructor(private readonly session: DocumentSession) { this.registry = new CommandRegistry(session); }
  execute(line: string): string {
    const tokens = this.tokenizer.split(line); if (!tokens.length) return "";
    return this.session.execute(this.registry.build(tokens[0]!, tokens.slice(1)));
  }
  async run(input: Readable, output: Writable, errors: Writable, interactive = false, stopOnError = false): Promise<number> {
    const reader = createInterface({ input, output, terminal: interactive, crlfDelay: Infinity });
    let failed = false, interrupted = false, closed = false, inputFailed = false;
    reader.on("close", () => { closed = true; });
    reader.on("SIGINT", () => { interrupted = true; reader.close(); });
    const onInputError = (error: Error): void => {
      errors.write(`error: ${new EditorError(error.message).message}\n`);
      failed = true; inputFailed = true; reader.close();
    };
    input.on("error", onInputError);
    if (interactive) {
      output.write("svg-editor 2.0 — type 'help' for commands\n"); reader.setPrompt("svg> "); reader.prompt();
    }
    try {
      for await (const line of reader) {
        try { const result = this.execute(line); if (result) output.write(result + "\n"); }
        catch (error) {
          if (!(error instanceof EditorError)) throw error;
          errors.write(`error: ${error.message}\n`); failed = true;
          if (stopOnError) break;
        }
        if (!this.session.running) break;
        if (interactive && !closed) reader.prompt();
      }
    } catch (error) {
      // The stream listener already rendered this failure exactly once.
      if (!inputFailed) throw error;
    } finally { reader.close(); input.off("error", onInputError); }
    return interrupted ? 130 : failed ? 1 : 0;
  }
}
