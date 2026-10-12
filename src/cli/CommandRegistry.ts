import type { Command } from "../application/Command";
import type { DocumentSession } from "../application/DocumentSession";
import { AddToCommand } from "../application/commands/AddToCommand";
import { BackCommand } from "../application/commands/BackCommand";
import { CanvasCommand } from "../application/commands/CanvasCommand";
import { CreateCommand } from "../application/commands/CreateCommand";
import { DeleteCommand } from "../application/commands/DeleteCommand";
import { FrontCommand } from "../application/commands/FrontCommand";
import { GroupCommand } from "../application/commands/GroupCommand";
import { HelpCommand } from "../application/commands/HelpCommand";
import { InitCommand } from "../application/commands/InitCommand";
import { MoveCommand } from "../application/commands/MoveCommand";
import { QuitCommand } from "../application/commands/QuitCommand";
import { ReadCommand } from "../application/commands/ReadCommand";
import { RedoCommand } from "../application/commands/RedoCommand";
import { SaveCommand } from "../application/commands/SaveCommand";
import { ScaleCommand } from "../application/commands/ScaleCommand";
import { SetCommand } from "../application/commands/SetCommand";
import { ShowCommand } from "../application/commands/ShowCommand";
import { TreeCommand } from "../application/commands/TreeCommand";
import { UndoCommand } from "../application/commands/UndoCommand";
import { UngroupCommand } from "../application/commands/UngroupCommand";
import { EditorError } from "../domain/EditorError";
import { ShapeFactory } from "../domain/ShapeFactory";
import { Arguments } from "./Arguments";

type Registration = { syntax: string; needsDocument: boolean; build: (args: Arguments) => Command };

/** The only command-name dispatch; provider registration is a Phase 2 seam. */
export class CommandRegistry {
  private readonly registrations = new Map<string, Registration>();
  constructor(private readonly session: DocumentSession, private readonly factory = new ShapeFactory()) {
    this.register("init", "init [w] [h]", false, args => {
      args.expect([0, 1, 2]); return new InitCommand(session, args.length ? args.number(0) : 800, args.length > 1 ? args.number(1) : 600);
    });
    this.register("read", "read <file.svg>", false, args => { args.expect([1]); return new ReadCommand(session, args.at(0)); });
    this.register("save", "save [file.svg]", true, args => { args.expect([0, 1]); return new SaveCommand(session, args.optional(0)); });
    this.register("canvas", "canvas [w] [h]", true, args => {
      args.expect([0, 1, 2]); return new CanvasCommand(session, args.length ? args.number(0) : undefined, args.length > 1 ? args.number(1) : undefined);
    });
    this.register("create", "create <type> <id> [params...] [in <containerId>]", true, args => {
      const { parameters, parent } = args.withParent();
      if (parameters.length < 2) throw new EditorError("create requires a type and an explicit id");
      return new CreateCommand(session, this.factory, parameters.at(0), parameters.at(1), parameters.slice(2), parent);
    });
    this.register("delete", "delete <id>", true, args => { args.expect([1]); return new DeleteCommand(session, args.at(0)); });
    this.register("move", "move <id> <dx> <dy>", true, args => { args.expect([3]); return new MoveCommand(session, args.at(0), args.number(1), args.number(2)); });
    this.register("scale", "scale <id> <factor>", true, args => { args.expect([2]); return new ScaleCommand(session, args.at(0), args.number(1)); });
    this.register("set", "set <id> <attr> <value>", true, args => { args.expect([3]); return new SetCommand(session, args.at(0), args.at(1), args.at(2)); });
    this.register("group", "group <newGid> <id1> <id2>...", true, args => {
      if (args.length < 2) throw new EditorError("group requires an explicit id and at least one member");
      return new GroupCommand(session, args.at(0), args.slice(1));
    });
    this.register("ungroup", "ungroup <gid>", true, args => { args.expect([1]); return new UngroupCommand(session, args.at(0)); });
    this.register("addto", "addto <gid> <id>", true, args => { args.expect([2]); return new AddToCommand(session, args.at(0), args.at(1)); });
    this.register("front", "front <id>", true, args => { args.expect([1]); return new FrontCommand(session, args.at(0)); });
    this.register("back", "back <id>", true, args => { args.expect([1]); return new BackCommand(session, args.at(0)); });
    this.register("tree", "tree [id]", true, args => { args.expect([0, 1]); return new TreeCommand(session, args.optional(0)); });
    this.register("show", "show <id>", true, args => { args.expect([1]); return new ShowCommand(session, args.at(0)); });
    this.register("help", "help", false, args => { args.expect([0]); return new HelpCommand(session, this.help()); });
    this.register("undo", "undo", true, args => { args.expect([0]); return new UndoCommand(session); });
    this.register("redo", "redo", true, args => { args.expect([0]); return new RedoCommand(session); });
    this.register("quit", "quit (exit the CLI)", false, args => { args.expect([0]); return new QuitCommand(session); });
  }
  private register(name: string, syntax: string, needsDocument: boolean, build: Registration["build"]): void {
    this.registrations.set(name, { syntax, needsDocument, build });
  }
  build(name: string, tokens: readonly string[]): Command {
    const registration = this.registrations.get(name);
    if (!registration) throw new EditorError(`unknown command: ${name}`);
    if (registration.needsDocument) this.session.requireDocument();
    return registration.build(new Arguments(tokens));
  }
  help(): string {
    return [...this.registrations.values()].map(item => item.syntax).join("\n") + "\n\n" +
      'create rect <id> <x> <y> <w> <h> [fill]\n' +
      'create circle <id> <cx> <cy> <r> [fill]\n' +
      'create ellipse <id> <cx> <cy> <rx> <ry> [fill]\n' +
      'create line <id> <x1> <y1> <x2> <y2> [stroke]\n' +
      'create text <id> <x> <y> "content"\ncreate g <id>\n' +
      'All create forms accept a trailing in <containerId>. IDs are mandatory and case-sensitive.\n' +
      'set: fill, stroke, stroke-width, type geometry; text content uses text.\n' +
      'Comments begin with # at the start of a line. IO commands block undo/redo until the next edit.';
  }
}
