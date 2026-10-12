import test from "node:test";
import assert from "node:assert/strict";
import { Document } from "../src/domain/Document";
import { ShapeFactory } from "../src/domain/ShapeFactory";
import { DocumentSession } from "../src/application/DocumentSession";
import type { Command } from "../src/application/Command";
import { InitCommand } from "../src/application/commands/InitCommand";
import { ReadCommand } from "../src/application/commands/ReadCommand";
import { SaveCommand } from "../src/application/commands/SaveCommand";
import { CanvasCommand } from "../src/application/commands/CanvasCommand";
import { CreateCommand } from "../src/application/commands/CreateCommand";
import { MoveCommand } from "../src/application/commands/MoveCommand";
import { ScaleCommand } from "../src/application/commands/ScaleCommand";
import { SetCommand } from "../src/application/commands/SetCommand";
import { GroupCommand } from "../src/application/commands/GroupCommand";
import { UngroupCommand } from "../src/application/commands/UngroupCommand";
import { AddToCommand } from "../src/application/commands/AddToCommand";
import { FrontCommand } from "../src/application/commands/FrontCommand";
import { BackCommand } from "../src/application/commands/BackCommand";
import { DeleteCommand } from "../src/application/commands/DeleteCommand";
import { TreeCommand } from "../src/application/commands/TreeCommand";
import { ShowCommand } from "../src/application/commands/ShowCommand";
import { MemoryStore } from "./helpers/MemoryStore";

test("session starts without a document and IO commands block undo and redo", () => {
  const s = new DocumentSession(new MemoryStore());
  assert.throws(() => s.requireDocument(), /no document. use 'init' or 'read' first/);
  assert.throws(() => s.undo(), /no document/);
  s.execute(new InitCommand(s));
  assert.throws(() => s.undo(), /undo not allowed after io command/);
  assert.throws(() => s.redo(), /undo not allowed after io command/);
});

test("one editing object is one undo unit; full sequence restores exact documents", () => {
  const s = new DocumentSession(new MemoryStore()), factory = new ShapeFactory();
  s.execute(new InitCommand(s)); const states = [s.requireDocument().toSvg()];
  const commands: Command[] = [new CreateCommand(s, factory, "g", "scene", []),
    new CreateCommand(s, factory, "rect", "r", ["10", "20", "30", "40"], "scene"),
    new CreateCommand(s, factory, "circle", "c", ["5", "6", "7"], "scene"),
    new GroupCommand(s, "inner", ["c", "r"]), new MoveCommand(s, "inner", 30, 40),
    new ScaleCommand(s, "inner", 2), new SetCommand(s, "c", "fill", "red"),
    new UngroupCommand(s, "inner"), new FrontCommand(s, "r"), new BackCommand(s, "r"),
    new AddToCommand(s, "scene", "c"), new DeleteCommand(s, "r")];
  for (const command of commands) { s.execute(command); states.push(s.requireDocument().toSvg()); }
  assert.equal(s.historyCounts[0], commands.length);
  for (const expected of states.slice(0, -1).reverse()) { s.undo(); assert.equal(s.requireDocument().toSvg(), expected); }
  for (const expected of states.slice(1)) { s.redo(); assert.equal(s.requireDocument().toSvg(), expected); }
});

test("a failed group or geometry edit changes no document, history or redo branch", () => {
  const s = new DocumentSession(new MemoryStore()), f = new ShapeFactory(); s.execute(new InitCommand(s));
  s.execute(new CreateCommand(s, f, "circle", "c", ["1", "2", "3"]));
  s.execute(new MoveCommand(s, "c", 30, 0)); s.undo(); const before = s.requireDocument().toSvg();
  for (const command of [new GroupCommand(s, "bad", ["c", "missing"]), new ScaleCommand(s, "c", 0),
    new SetCommand(s, "c", "r", "-1"), new MoveCommand(s, "missing", 1, 2)]) {
    assert.throws(() => s.execute(command)); assert.equal(s.requireDocument().toSvg(), before);
    assert.deepEqual(s.historyCounts, [1, 1]);
  }
  s.redo(); assert.equal(s.requireDocument().find("c").attribute("cx"), "31");
});

test("new successful edit clears redo, including a successful no-change set", () => {
  const s = new DocumentSession(new MemoryStore()), f = new ShapeFactory(); s.execute(new InitCommand(s));
  s.execute(new CreateCommand(s, f, "circle", "c", ["1", "2", "3"])); s.execute(new MoveCommand(s, "c", 1, 0)); s.undo();
  s.execute(new SetCommand(s, "c", "r", "3")); assert.deepEqual(s.historyCounts, [2, 0]);
  assert.throws(() => s.redo(), /nothing to redo/);
});

test("save, read, init and canvas resize each install a history barrier", () => {
  const store = new MemoryStore(), s = new DocumentSession(store), f = new ShapeFactory();
  store.put("import.svg", new Document(100, 200)); s.execute(new InitCommand(s));
  for (const io of [new SaveCommand(s, "out.svg"), new CanvasCommand(s, 400, 300), new ReadCommand(s, "import.svg"), new InitCommand(s)]) {
    s.execute(new CreateCommand(s, f, "g", "g", [])); s.execute(io);
    assert.throws(() => s.undo(), /undo not allowed after io command/);
    assert.throws(() => s.redo(), /undo not allowed after io command/);
    // Ensure the next iteration can use the same ID after crossing the barrier.
    s.execute(new InitCommand(s));
  }
});

test("display and canvas query do not alter history or unlock an IO barrier", () => {
  const s = new DocumentSession(new MemoryStore()), f = new ShapeFactory(); s.execute(new InitCommand(s));
  s.execute(new CanvasCommand(s)); assert.throws(() => s.undo(), /io command/);
  s.execute(new CreateCommand(s, f, "circle", "c", ["1", "2", "3"]));
  for (const display of [new CanvasCommand(s), new TreeCommand(s), new ShowCommand(s, "c")]) s.execute(display);
  assert.deepEqual(s.historyCounts, [1, 0]); s.undo(); assert.equal(s.requireDocument().all().length, 0);
});

test("read and save failures leave active document, file path and history untouched", () => {
  const store = new MemoryStore(), s = new DocumentSession(store), f = new ShapeFactory();
  s.execute(new InitCommand(s)); s.execute(new CreateCommand(s, f, "g", "g", []));
  s.execute(new SaveCommand(s, "original.svg")); s.execute(new MoveCommand(s, "g", 1, 2));
  const before = s.requireDocument().toSvg(); store.setWriteFailure(true);
  for (const command of [new ReadCommand(s, "missing.svg"), new SaveCommand(s, "new.svg"), new CanvasCommand(s, -1, 10), new InitCommand(s, -1, 10)]) {
    assert.throws(() => s.execute(command)); assert.equal(s.requireDocument().toSvg(), before);
    assert.equal(s.filePath, "original.svg"); assert.deepEqual(s.historyCounts, [1, 0]);
  }
  s.undo();
});

test("after read, save without a path writes to that path and blocks history", () => {
  const store = new MemoryStore(), s = new DocumentSession(store), f = new ShapeFactory(); store.put("input.svg", new Document());
  s.execute(new ReadCommand(s, "input.svg")); s.execute(new CreateCommand(s, f, "g", "new", []));
  assert.match(s.execute(new SaveCommand(s)), /saved to input.svg/);
  assert.equal(store.read("input.svg").document.find("new").type, "g"); assert.throws(() => s.undo(), /io command/);
});

test("course move/undo/redo feedback includes resulting coordinates", () => {
  const s = new DocumentSession(new MemoryStore()), f = new ShapeFactory(); s.execute(new InitCommand(s));
  s.execute(new CreateCommand(s, f, "circle", "c1", ["100", "100", "20", "red"]));
  assert.equal(s.execute(new MoveCommand(s, "c1", 30, 0)), "circle#c1 moved to (130,100)");
  assert.equal(s.undo(), "circle#c1 moved back to (100,100)");
  assert.equal(s.redo(), "circle#c1 moved to (130,100)");
});

test("history stays bounded and does not contain IO commands", () => {
  const s = new DocumentSession(new MemoryStore()), f = new ShapeFactory(); s.execute(new InitCommand(s));
  s.execute(new CreateCommand(s, f, "g", "g", []));
  for (let index = 0; index < 101; index++) s.execute(new MoveCommand(s, "g", 1, 0));
  assert.deepEqual(s.historyCounts, [100, 0]);
});

test("partial overflow across a composite rolls back the entire editing command", () => {
  const s = new DocumentSession(new MemoryStore()), f = new ShapeFactory(); s.execute(new InitCommand(s));
  s.execute(new CreateCommand(s, f, "g", "g", []));
  s.execute(new CreateCommand(s, f, "circle", "normal", ["1", "2", "3"], "g"));
  s.execute(new CreateCommand(s, f, "circle", "large", ["1e308", "0", "1"], "g"));
  const before = s.requireDocument().toSvg(), history = s.historyCounts;
  assert.throws(() => s.execute(new ScaleCommand(s, "g", 2)), /invalid number/);
  assert.equal(s.requireDocument().toSvg(), before); assert.deepEqual(s.historyCounts, history);
});
